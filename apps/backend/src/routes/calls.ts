import type { Request, Response } from "express";
import { eq, and, sql, desc, gte, lte, or, like } from "drizzle-orm";
import { db } from "../config/db.js";
import { calls, callQueue, clients, contacts, followUps, campaigns } from "@repo/db";
import { processNextEligibleCall } from "../worker/processQueue.js";
import { calculateNextRetrySchedule } from "../utils/retrySchedule.js";

/**
 * The shape posted by /apps/calling's dispatchCallCompleted.
 */
interface CallingServicePayload {
  schemaVersion: "1.0";
  deliveryId: string;
  requestId: string;
  plivoCallId: string;
  contactId: string;
  clientId: string;
  queueEntryId?: string;
  status: "completed" | "failed" | "interrupted" | "no_input" | "no_answer" | "delivery_pending";
  failureCategory?: string;
  failureReason?: string;
  retryable: boolean;
  startedAt: string; // ISO 8601
  endedAt: string; // ISO 8601
  durationSeconds: number;
  transcript: Array<{
    speaker: "user" | "assistant";
    text: string;
    timestamp: string;
    isComplete: boolean;
  }>;
  recording?: {
    storageKey?: string;
    durationSeconds?: number;
    sizeBytes?: number;
    mimeType?: string;
    available: boolean;
    unavailableReason?: string;
  };
  providerErrors: Array<{
    stage: string;
    category: string;
    message: string;
    retryCount: number;
    timestamp: string;
    retryable: boolean;
  }>;
  timings: {
    sttConnectMs?: number;
    greetingPlayedMs?: number;
    avgFirstSentenceMs?: number;
    avgFirstAudioMs?: number;
  };
  analysis?: {
    summary: string;
    interestLevel: "high" | "medium" | "low" | "unknown";
    sentiment: "positive" | "neutral" | "negative";
    objectionsRaised: string[];
    followUpRequested: boolean;
    requestedCallbackTime?: string;
    notes?: string;
  };
  costEstimate?: {
    credits: number;
    costTelephony?: number;
    costStt?: number;
    costLlm?: number;
    costTts?: number;
    totalEstimatedCost?: number;
  };
}

/**
 * Maps the calling service's CallStatus to the DB's call_outcome enum values.
 */
function mapStatusToOutcome(
  status: CallingServicePayload["status"]
): "connected" | "no_answer" | "busy" | "voicemail" | "dropped_early" | "failed" {
  switch (status) {
    case "completed":
      return "connected";
    case "no_answer":
      return "no_answer";
    case "no_input":
      return "no_answer";
    case "interrupted":
      return "dropped_early";
    case "failed":
    case "delivery_pending":
    default:
      return "failed";
  }
}

/**
 * POST /api/calls/complete
 *
 * Webhook endpoint receiving the completed call payload from /apps/calling.
 */
export async function callCompleteRoute(req: Request, res: Response) {
  try {
    const payload = req.body as CallingServicePayload;

    const validStatuses: CallingServicePayload["status"][] = [
      "completed", "failed", "interrupted", "no_input", "no_answer", "delivery_pending",
    ];
    const isUuid = (value: unknown): value is string =>
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    const startedAt = typeof payload?.startedAt === "string" ? new Date(payload.startedAt) : new Date(NaN);
    const endedAt = typeof payload?.endedAt === "string" ? new Date(payload.endedAt) : new Date(NaN);

    if (
      payload?.schemaVersion !== "1.0" ||
      typeof payload.deliveryId !== "string" ||
      payload.deliveryId.length < 1 ||
      payload.deliveryId.length > 200 ||
      !isUuid(payload.contactId) ||
      !isUuid(payload.clientId) ||
      (payload.queueEntryId !== undefined && !isUuid(payload.queueEntryId)) ||
      !validStatuses.includes(payload.status) ||
      !Number.isInteger(payload.durationSeconds) ||
      payload.durationSeconds < 0 ||
      payload.durationSeconds > 24 * 60 * 60 ||
      Number.isNaN(startedAt.getTime()) ||
      Number.isNaN(endedAt.getTime()) ||
      endedAt < startedAt ||
      !Array.isArray(payload.transcript) ||
      payload.transcript.length > 2000
    ) {
      return res.status(400).json({
        ok: false,
        error: "Invalid call completion payload",
      });
    }

    const invalidTranscriptItem = payload.transcript.some((item) =>
      !item ||
      (item.speaker !== "user" && item.speaker !== "assistant") ||
      typeof item.text !== "string" ||
      item.text.length > 10000 ||
      typeof item.timestamp !== "string" ||
      Number.isNaN(new Date(item.timestamp).getTime()) ||
      typeof item.isComplete !== "boolean",
    );
    if (invalidTranscriptItem) {
      return res.status(400).json({ ok: false, error: "Invalid call transcript payload" });
    }
    if (typeof payload.retryable !== "boolean") {
      return res.status(400).json({ ok: false, error: "Invalid retryable value" });
    }
    if (payload.analysis) {
      const analysis = payload.analysis;
      if (
        typeof analysis !== "object" ||
        typeof analysis.summary !== "string" ||
        analysis.summary.length > 10000 ||
        !["high", "medium", "low", "unknown"].includes(analysis.interestLevel) ||
        !["positive", "neutral", "negative"].includes(analysis.sentiment) ||
        !Array.isArray(analysis.objectionsRaised) ||
        analysis.objectionsRaised.length > 100 ||
        analysis.objectionsRaised.some((item) => typeof item !== "string" || item.length > 1000) ||
        typeof analysis.followUpRequested !== "boolean" ||
        (analysis.notes !== undefined && (typeof analysis.notes !== "string" || analysis.notes.length > 5000)) ||
        (analysis.requestedCallbackTime !== undefined &&
          (typeof analysis.requestedCallbackTime !== "string" ||
            Number.isNaN(new Date(analysis.requestedCallbackTime).getTime())))
      ) {
        return res.status(400).json({ ok: false, error: "Invalid call analysis payload" });
      }
    }

    const outcome = mapStatusToOutcome(payload.status);
    const isBillable = outcome === "connected";

    // 1 credit per 10s connected unit
    const creditsCharged = isBillable
      ? Math.ceil(payload.durationSeconds / 10)
      : 0;

    const safeCost = (value: number | undefined, fallback: number) =>
      typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1_000_000
        ? value
        : fallback;
    const costTelephony = safeCost(payload.costEstimate?.costTelephony, isBillable ? Number(((payload.durationSeconds / 60) * 0.015).toFixed(4)) : 0);
    const costStt = safeCost(payload.costEstimate?.costStt, isBillable ? Number((payload.durationSeconds * 0.0006).toFixed(4)) : 0);
    const costLlm = safeCost(payload.costEstimate?.costLlm, 0);
    const costTts = safeCost(payload.costEstimate?.costTts, 0);
    const costTotal = safeCost(payload.costEstimate?.totalEstimatedCost, Number((costTelephony + costStt + costLlm + costTts).toFixed(4)));

    const analysis = payload.analysis;

    const completion = await db.transaction(async (tx) => {
    const [existingCall] = await tx
      .select({ id: calls.id, creditsCharged: calls.creditsCharged })
      .from(calls)
      .where(eq(calls.deliveryId, payload.deliveryId))
      .limit(1);
    if (existingCall) {
      return { duplicate: true as const, callId: existingCall.id, creditsCharged: existingCall.creditsCharged };
    }

    // Find the matching queue entry
    let queueEntryId: string | null = null;
    let attemptNumber = 1;

    const queueConditions = [
      eq(callQueue.contactId, payload.contactId),
      eq(callQueue.clientId, payload.clientId),
      eq(callQueue.status, "in_progress"),
    ];
    if (payload.queueEntryId) queueConditions.push(eq(callQueue.id, payload.queueEntryId));

    const [queueEntry] = await tx
      .select()
      .from(callQueue)
      .where(and(...queueConditions))
      .orderBy(sql`${callQueue.updatedAt} DESC`)
      .limit(1);

    if (queueEntry) {
      queueEntryId = queueEntry.id;
      attemptNumber = queueEntry.attemptNumber;
    }

    // Look up client
    const [client] = await tx
      .select()
      .from(clients)
      .where(eq(clients.id, payload.clientId))
      .limit(1);

    // Look up contact
    const [contact] = await tx
      .select({
        fullName: contacts.fullName,
        phoneNumber: contacts.phoneNumber,
        companyName: contacts.companyName,
        jobTitle: contacts.jobTitle,
        optOut: contacts.optOut,
      })
      .from(contacts)
      .where(and(eq(contacts.id, payload.contactId), eq(contacts.clientId, payload.clientId)))
      .limit(1);

    if (!client || !contact) {
      return { notFound: true as const };
    }

    // 1. Insert call record
    const [callRecord] = await tx
      .insert(calls)
      .values({
        deliveryId: payload.deliveryId,
        contactId: payload.contactId,
        clientId: payload.clientId,
        campaignId: queueEntry?.campaignId ?? null,
        queueEntryId,
        contactName: contact?.fullName ?? null,
        phoneNumber: contact?.phoneNumber ?? null,
        attemptNumber,
        startedAt,
        endedAt,
        durationSeconds: payload.durationSeconds ?? 0,
        outcome,
        isBillable,
        creditsCharged,
        summary: analysis?.summary ?? null,
        interestLevel: analysis?.interestLevel ?? null,
        sentiment: analysis?.sentiment ?? null,
        objectionsRaised: analysis?.objectionsRaised ?? null,
        followUpRequested: analysis?.followUpRequested ?? false,
        costTelephony,
        costStt,
        costLlm,
        costTts,
        costTotal,
        recordingUrl: payload.recording?.available ? payload.recording.storageKey ?? null : null,
        transcript: payload.transcript,
      })
      .onConflictDoNothing({ target: calls.deliveryId })
      .returning();

    if (!callRecord) {
      const [duplicate] = await tx
        .select({ id: calls.id, creditsCharged: calls.creditsCharged })
        .from(calls)
        .where(eq(calls.deliveryId, payload.deliveryId))
        .limit(1);
      if (duplicate) {
        return { duplicate: true as const, callId: duplicate.id, creditsCharged: duplicate.creditsCharged };
      }
      throw new Error("Failed to insert call record");
    }

    // 2. Follow-up ingestion
    let followUpId: string | null = null;
    if (analysis?.followUpRequested || analysis?.requestedCallbackTime) {
      let callbackDate: Date | null = null;
      if (analysis?.requestedCallbackTime) {
        const parsed = new Date(analysis.requestedCallbackTime);
        if (!isNaN(parsed.getTime())) {
          callbackDate = parsed;
        }
      }

      const notes =
        analysis?.notes?.trim() ||
        analysis?.summary?.trim() ||
        (callbackDate ? `Callback requested for ${callbackDate.toISOString()}` : "Follow-up requested during call");

      const [createdFollowUp] = await tx
        .insert(followUps)
        .values({
          callId: callRecord.id,
          contactId: payload.contactId,
          clientId: payload.clientId,
          type: "call_back",
          priority: analysis?.interestLevel === "high" ? "high" : "medium",
          requestedCallbackTime: callbackDate,
          dueDate: callbackDate,
          status: "open",
          notes,
        })
        .returning();

      if (createdFollowUp) {
        followUpId = createdFollowUp.id;
        console.log(`[calls/complete] 📋 Created follow-up ${followUpId} for contact ${payload.contactId}`);
      }
    }

    // 3. Update call_queue and contacts with retry or exhaustion logic
    let finalQueueStatus: "completed" | "pending" | "exhausted" | "failed" = "completed";
    let retryScheduledFor: Date | null = null;

    if (queueEntry) {
      const isConnected = outcome === "connected";
      const isRetryable = payload.retryable !== false && !isConnected;
      const maxAttempts = queueEntry.maxAttempts ?? 2;
      const currentAttempt = queueEntry.attemptNumber ?? 1;

      if (isConnected) {
        finalQueueStatus = "completed";
        await tx
          .update(callQueue)
          .set({ status: "completed", reservedCredits: 0, updatedAt: new Date() })
          .where(and(eq(callQueue.id, queueEntry.id), eq(callQueue.status, "in_progress")));

        if (!contact.optOut) {
          await tx
            .update(contacts)
            .set({ status: "completed", updatedAt: new Date() })
            .where(and(eq(contacts.id, payload.contactId), eq(contacts.clientId, payload.clientId)));
        }
      } else if (isRetryable && currentAttempt < maxAttempts && !contact.optOut) {
        finalQueueStatus = "pending";
        retryScheduledFor = calculateNextRetrySchedule(
          client?.timezone ?? "Asia/Kolkata",
          client?.callingHoursStart,
          client?.callingHoursEnd,
          2
        );

        await tx
          .update(callQueue)
          .set({
            attemptNumber: currentAttempt + 1,
            scheduledFor: retryScheduledFor,
            status: "pending",
            reservedCredits: 0,
            updatedAt: new Date(),
          })
          .where(and(eq(callQueue.id, queueEntry.id), eq(callQueue.status, "in_progress")));

        await tx
          .update(contacts)
          .set({ status: "queued", updatedAt: new Date() })
          .where(and(eq(contacts.id, payload.contactId), eq(contacts.clientId, payload.clientId)));

        console.log(
          `[calls/complete] 🔄 Scheduled retry attempt ${currentAttempt + 1} of ${maxAttempts} for contact ${payload.contactId} at ${retryScheduledFor.toISOString()}`
        );
      } else {
        finalQueueStatus = "exhausted";
        await tx
          .update(callQueue)
          .set({ status: "exhausted", reservedCredits: 0, updatedAt: new Date() })
          .where(and(eq(callQueue.id, queueEntry.id), eq(callQueue.status, "in_progress")));

        if (!contact.optOut) {
          await tx
            .update(contacts)
            .set({ status: "completed", updatedAt: new Date() })
            .where(and(eq(contacts.id, payload.contactId), eq(contacts.clientId, payload.clientId)));
        }

        console.log(
          `[calls/complete] 🛑 Call attempts exhausted (${currentAttempt}/${maxAttempts}) for contact ${payload.contactId}`
        );
      }
    }

    // 4. Update client billing counters & detailed credit logging
    let updatedTotalCreditsUsed = client?.creditsUsedThisCycle ?? 0;
    const reservationToRelease = queueEntry?.reservedCredits ?? 0;
    const clientUpdate = {
      creditsReservedThisCycle: sql`greatest(0, ${clients.creditsReservedThisCycle} - ${reservationToRelease})`,
      updatedAt: new Date(),
      ...(isBillable && creditsCharged > 0
        ? { creditsUsedThisCycle: sql`${clients.creditsUsedThisCycle} + ${creditsCharged}` }
        : {}),
    };
    const [updatedClient] = await tx
      .update(clients)
      .set(clientUpdate)
      .where(eq(clients.id, payload.clientId))
      .returning({
        creditsUsed: clients.creditsUsedThisCycle,
        creditsReserved: clients.creditsReservedThisCycle,
        allowance: clients.monthlyCreditsAllowance,
      });

    if (updatedClient) {
      updatedTotalCreditsUsed = updatedClient.creditsUsed;
    }

    console.log(`[calls/complete] 💳 Call Log & Cost Summary:`);
    console.log(`                 Contact: ${contact?.fullName || payload.contactId} (${contact?.phoneNumber || "N/A"}) ${contact?.companyName ? `[${contact.companyName}]` : ""}`);
    console.log(`                 Outcome: ${outcome} | Duration: ${payload.durationSeconds}s | Billable: ${isBillable}`);
    console.log(`                 Credits Charged: ${creditsCharged} credits (Cycle total: ${updatedTotalCreditsUsed}/${client?.monthlyCreditsAllowance ?? "N/A"})`);
    console.log(`                 Provider Costs: Total=$${costTotal} (Telephony=$${costTelephony}, STT=$${costStt}, LLM=$${costLlm}, TTS=$${costTts})`);

    return {
      duplicate: false as const,
      callId: callRecord.id,
      creditsCharged,
      creditsUsedThisCycle: updatedTotalCreditsUsed,
      creditsRemaining: Math.max(
        0,
        (updatedClient?.allowance ?? client.monthlyCreditsAllowance) -
          updatedTotalCreditsUsed -
          (updatedClient?.creditsReserved ?? 0),
      ),
      queueStatus: finalQueueStatus,
      retryScheduledFor: retryScheduledFor?.toISOString(),
      followUpId: followUpId ?? undefined,
      costBreakdown: {
        costTelephony,
        costStt,
        costLlm,
        costTts,
        totalCost: costTotal,
      },
    };
    });

    if ("notFound" in completion) {
      return res.status(404).json({ ok: false, error: "Client or contact not found in the specified workspace" });
    }
    if (completion.duplicate) {
      return res.status(200).json({
        ok: true,
        duplicate: true,
        callId: completion.callId,
        creditsCharged: completion.creditsCharged,
      });
    }

    void processNextEligibleCall().catch((err) => {
      console.error("[calls/complete] Worker trigger error:", err);
    });

    return res.status(201).json({ ok: true, ...completion });
  } catch (err: unknown) {
    console.error("[calls/complete] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * GET /api/calls
 *
 * List calls with filtering and pagination.
 */
export async function getCallsRoute(req: Request, res: Response) {
  try {
    const {
      campaignId,
      outcome,
      sentiment,
      interestLevel,
      search,
      startDate,
      endDate,
      limit,
      offset,
    } = req.query as {
      campaignId?: string;
      outcome?: string;
      sentiment?: string;
      interestLevel?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
      limit?: string;
      offset?: string;
    };

    const take = Math.min(Math.max(parseInt(limit || "50", 10) || 50, 1), 100);
    const skip = Math.max(parseInt(offset || "0", 10) || 0, 0);

    const conditions = [eq(calls.clientId, req.clientId!)];

    if (campaignId) {
      conditions.push(eq(calls.campaignId, campaignId));
    }

    if (outcome) {
      conditions.push(eq(calls.outcome, outcome as any));
    }

    if (sentiment) {
      conditions.push(eq(calls.sentiment, sentiment as any));
    }

    if (interestLevel) {
      conditions.push(eq(calls.interestLevel, interestLevel as any));
    }

    if (startDate) {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) conditions.push(gte(calls.startedAt, d));
    }

    if (endDate) {
      const d = new Date(endDate);
      if (!isNaN(d.getTime())) conditions.push(lte(calls.startedAt, d));
    }

    if (search && search.trim()) {
      const pattern = `%${search.trim()}%`;
      const searchOr = or(
        like(calls.contactName, pattern),
        like(calls.phoneNumber, pattern),
        like(calls.summary, pattern)
      );
      if (searchOr) conditions.push(searchOr);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select({
        id: calls.id,
        contactId: calls.contactId,
        clientId: calls.clientId,
        campaignId: calls.campaignId,
        contactName: calls.contactName,
        phoneNumber: calls.phoneNumber,
        attemptNumber: calls.attemptNumber,
        startedAt: calls.startedAt,
        endedAt: calls.endedAt,
        durationSeconds: calls.durationSeconds,
        outcome: calls.outcome,
        isBillable: calls.isBillable,
        creditsCharged: calls.creditsCharged,
        summary: calls.summary,
        interestLevel: calls.interestLevel,
        sentiment: calls.sentiment,
        followUpRequested: calls.followUpRequested,
        objectionsRaised: calls.objectionsRaised,
        costTotal: calls.costTotal,
        recordingUrl: calls.recordingUrl,
        createdAt: calls.createdAt,
        campaignName: campaigns.name,
      })
      .from(calls)
      .leftJoin(campaigns, eq(calls.campaignId, campaigns.id))
      .where(whereClause)
      .orderBy(desc(calls.startedAt))
      .limit(take)
      .offset(skip);

    const [countResult] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(calls)
      .where(whereClause);

    const total = countResult?.total ?? items.length;

    return res.json({
      ok: true,
      calls: items,
      total,
      limit: take,
      offset: skip,
    });
  } catch (err: unknown) {
    console.error("[calls/get] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * GET /api/calls/:id
 *
 * Full details of a single call including transcript, cost breakdown, and contact details.
 */
export async function getCallByIdRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Call ID parameter is required" });
    }

    const [callItem] = await db
      .select({
        id: calls.id,
        contactId: calls.contactId,
        clientId: calls.clientId,
        campaignId: calls.campaignId,
        queueEntryId: calls.queueEntryId,
        contactName: calls.contactName,
        phoneNumber: calls.phoneNumber,
        attemptNumber: calls.attemptNumber,
        startedAt: calls.startedAt,
        endedAt: calls.endedAt,
        durationSeconds: calls.durationSeconds,
        outcome: calls.outcome,
        isBillable: calls.isBillable,
        creditsCharged: calls.creditsCharged,
        summary: calls.summary,
        interestLevel: calls.interestLevel,
        sentiment: calls.sentiment,
        objectionsRaised: calls.objectionsRaised,
        followUpRequested: calls.followUpRequested,
        costTelephony: calls.costTelephony,
        costStt: calls.costStt,
        costLlm: calls.costLlm,
        costTts: calls.costTts,
        costTotal: calls.costTotal,
        recordingUrl: calls.recordingUrl,
        transcript: calls.transcript,
        createdAt: calls.createdAt,
        contact: {
          id: contacts.id,
          fullName: contacts.fullName,
          email: contacts.email,
          companyName: contacts.companyName,
          jobTitle: contacts.jobTitle,
          department: contacts.department,
          industry: contacts.industry,
          city: contacts.city,
          leadScore: contacts.leadScore,
          lifecycleStage: contacts.lifecycleStage,
          accountTier: contacts.accountTier,
          courseOrStream: contacts.courseOrStream,
        },
        campaign: {
          id: campaigns.id,
          name: campaigns.name,
          type: campaigns.type,
          primaryObjective: campaigns.primaryObjective,
        },
      })
      .from(calls)
      .leftJoin(contacts, eq(calls.contactId, contacts.id))
      .leftJoin(campaigns, eq(calls.campaignId, campaigns.id))
      .where(and(eq(calls.id, id), eq(calls.clientId, req.clientId!)))
      .limit(1);

    if (!callItem) {
      return res.status(404).json({ ok: false, error: `Call with ID ${id} not found` });
    }

    return res.json({
      ok: true,
      call: callItem,
    });
  } catch (err: unknown) {
    console.error("[calls/getById] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
