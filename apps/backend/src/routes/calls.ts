import type { Request, Response } from "express";
import { eq, and, sql, desc, gte, lte, or, like } from "drizzle-orm";
import { db } from "../config/db.js";
import { calls, callQueue, clients, contacts, followUps, campaigns } from "@repo/db";
import { processNextEligibleCall } from "../worker/processQueue.js";
import { calculateNextRetrySchedule } from "../utils/retrySchedule.js";

/**
 * The shape posted by /apps/calling's dispatchCallCompleted (see callTypes.ts → CallResult).
 */
interface CallingServicePayload {
  schemaVersion: "1.0";
  deliveryId: string;
  requestId: string;
  plivoCallId: string;
  contactId: string;
  clientId: string;
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
 * Webhook endpoint that receives the CallResult payload from /apps/calling
 * after a call finishes.
 */
export async function callCompleteRoute(req: Request, res: Response) {
  try {
    const payload = req.body as CallingServicePayload;

    // Basic validation
    if (!payload.contactId || !payload.clientId || !payload.status) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: contactId, clientId, and status are required",
      });
    }

    const outcome = mapStatusToOutcome(payload.status);
    const isBillable = outcome === "connected";

    // Compute credits: 1 credit per 10s connected unit
    const creditsCharged = isBillable
      ? (payload.costEstimate?.credits ?? Math.ceil((payload.durationSeconds || 0) / 10))
      : 0;

    // Provider cost breakdowns
    const costTelephony = payload.costEstimate?.costTelephony ?? (isBillable ? Number(((payload.durationSeconds / 60) * 0.015).toFixed(4)) : 0);
    const costStt = payload.costEstimate?.costStt ?? (isBillable ? Number((payload.durationSeconds * 0.0006).toFixed(4)) : 0);
    const costLlm = payload.costEstimate?.costLlm ?? 0;
    const costTts = payload.costEstimate?.costTts ?? 0;

    // Extract analysis fields
    const analysis = payload.analysis;

    // Find the queue entry this call belongs to
    let queueEntryId: string | null = null;
    let attemptNumber = 1;

    const [queueEntry] = await db
      .select()
      .from(callQueue)
      .where(
        and(
          eq(callQueue.contactId, payload.contactId),
          eq(callQueue.clientId, payload.clientId),
          eq(callQueue.status, "in_progress")
        )
      )
      .orderBy(sql`${callQueue.updatedAt} DESC`)
      .limit(1);

    if (queueEntry) {
      queueEntryId = queueEntry.id;
      attemptNumber = queueEntry.attemptNumber;
    }

    // Look up client
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, payload.clientId))
      .limit(1);

    // Look up contact
    const [contact] = await db
      .select({ fullName: contacts.fullName, phoneNumber: contacts.phoneNumber })
      .from(contacts)
      .where(eq(contacts.id, payload.contactId))
      .limit(1);

    // 1. Insert call record
    const [callRecord] = await db
      .insert(calls)
      .values({
        contactId: payload.contactId,
        clientId: payload.clientId,
        campaignId: queueEntry?.campaignId ?? null,
        queueEntryId,
        contactName: contact?.fullName ?? null,
        phoneNumber: contact?.phoneNumber ?? null,
        attemptNumber,
        startedAt: new Date(payload.startedAt),
        endedAt: payload.endedAt ? new Date(payload.endedAt) : null,
        durationSeconds: payload.durationSeconds ?? 0,
        outcome,
        isBillable,
        creditsCharged,
        costTelephony,
        costStt,
        costLlm,
        costTts,
        recordingUrl: payload.recording?.storageKey ?? null,
        transcript: payload.transcript,
        interestLevel: analysis?.interestLevel ?? null,
        objectionsRaised: analysis?.objectionsRaised ?? null,
        followUpRequested: analysis?.followUpRequested ?? false,
        sentiment: analysis?.sentiment ?? null,
      })
      .returning();

    if (!callRecord) {
      return res.status(500).json({ ok: false, error: "Failed to insert call record" });
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

      const [createdFollowUp] = await db
        .insert(followUps)
        .values({
          callId: callRecord.id,
          contactId: payload.contactId,
          clientId: payload.clientId,
          requestedCallbackTime: callbackDate,
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
        await db
          .update(callQueue)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(callQueue.id, queueEntry.id));

        await db
          .update(contacts)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(contacts.id, payload.contactId));
      } else if (isRetryable && currentAttempt < maxAttempts) {
        finalQueueStatus = "pending";
        retryScheduledFor = calculateNextRetrySchedule(
          client?.timezone ?? "Asia/Kolkata",
          client?.callingHoursStart,
          client?.callingHoursEnd,
          2
        );

        await db
          .update(callQueue)
          .set({
            attemptNumber: currentAttempt + 1,
            scheduledFor: retryScheduledFor,
            status: "pending",
            updatedAt: new Date(),
          })
          .where(eq(callQueue.id, queueEntry.id));

        await db
          .update(contacts)
          .set({ status: "queued", updatedAt: new Date() })
          .where(eq(contacts.id, payload.contactId));

        console.log(
          `[calls/complete] 🔄 Scheduled retry attempt ${currentAttempt + 1} of ${maxAttempts} for contact ${payload.contactId} at ${retryScheduledFor.toISOString()}`
        );
      } else {
        finalQueueStatus = "exhausted";
        await db
          .update(callQueue)
          .set({ status: "exhausted", updatedAt: new Date() })
          .where(eq(callQueue.id, queueEntry.id));

        await db
          .update(contacts)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(contacts.id, payload.contactId));

        console.log(
          `[calls/complete] 🛑 Call attempts exhausted (${currentAttempt}/${maxAttempts}) for contact ${payload.contactId}`
        );
      }
    }

    // 4. Update client billing counters & detailed credit logging
    let updatedTotalCreditsUsed = client?.creditsUsedThisCycle ?? 0;
    if (isBillable && creditsCharged > 0) {
      const [updatedClient] = await db
        .update(clients)
        .set({
          creditsUsedThisCycle: sql`${clients.creditsUsedThisCycle} + ${creditsCharged}`,
          updatedAt: new Date(),
        })
        .where(eq(clients.id, payload.clientId))
        .returning({ creditsUsed: clients.creditsUsedThisCycle, allowance: clients.monthlyCreditsAllowance });

      if (updatedClient) {
        updatedTotalCreditsUsed = updatedClient.creditsUsed;
      }
    }

    console.log(`[calls/complete] 💳 Call Log & Cost Summary:`);
    console.log(`                 Contact: ${contact?.fullName || payload.contactId} (${contact?.phoneNumber || "N/A"})`);
    console.log(`                 Outcome: ${outcome} | Duration: ${payload.durationSeconds}s | Billable: ${isBillable}`);
    console.log(`                 Credits Charged: ${creditsCharged} credits (Cycle total: ${updatedTotalCreditsUsed}/${client?.monthlyCreditsAllowance ?? "N/A"})`);
    console.log(`                 Provider Infrastructure Cost: Telephony=$${costTelephony}, STT=$${costStt}, LLM=$${costLlm}, TTS=$${costTts}`);

    // 5. Trigger the queue worker for the next eligible call
    void processNextEligibleCall().catch((err) => {
      console.error("[calls/complete] Worker trigger error:", err);
    });

    return res.status(201).json({
      ok: true,
      callId: callRecord.id,
      creditsCharged,
      creditsUsedThisCycle: updatedTotalCreditsUsed,
      creditsRemaining: client ? Math.max(0, client.monthlyCreditsAllowance - updatedTotalCreditsUsed) : undefined,
      queueStatus: finalQueueStatus,
      retryScheduledFor: retryScheduledFor ? retryScheduledFor.toISOString() : undefined,
      followUpId: followUpId ?? undefined,
      costBreakdown: {
        costTelephony,
        costStt,
        costLlm,
        costTts,
        totalCost: Number((costTelephony + costStt + costLlm + costTts).toFixed(4)),
      },
    });
  } catch (err: unknown) {
    console.error("[calls/complete] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * GET /api/calls
 *
 * List calls with filtering (clientId, campaignId, outcome, sentiment, interestLevel, search, date range)
 * and pagination (limit, offset).
 */
export async function getCallsRoute(req: Request, res: Response) {
  try {
    const {
      clientId,
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
      clientId?: string;
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

    const conditions = [];

    if (clientId) {
      conditions.push(eq(calls.clientId, clientId));
    }

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
      const searchOr = or(like(calls.contactName, pattern), like(calls.phoneNumber, pattern));
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
        interestLevel: calls.interestLevel,
        sentiment: calls.sentiment,
        followUpRequested: calls.followUpRequested,
        objectionsRaised: calls.objectionsRaised,
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
        costTelephony: calls.costTelephony,
        costStt: calls.costStt,
        costLlm: calls.costLlm,
        costTts: calls.costTts,
        recordingUrl: calls.recordingUrl,
        transcript: calls.transcript,
        interestLevel: calls.interestLevel,
        sentiment: calls.sentiment,
        objectionsRaised: calls.objectionsRaised,
        followUpRequested: calls.followUpRequested,
        createdAt: calls.createdAt,
        contact: {
          id: contacts.id,
          fullName: contacts.fullName,
          email: contacts.email,
          courseOrStream: contacts.courseOrStream,
          parentName: contacts.parentName,
          studentName: contacts.studentName,
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
      .where(eq(calls.id, id))
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
