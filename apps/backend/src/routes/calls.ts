import type { Request, Response } from "express";
import { eq, and, sql, desc, gte, lte, or, like, inArray } from "drizzle-orm";
import { db } from "../config/db.js";
import { calls, callQueue, clients, contacts, followUps, campaigns, users, callRecordings } from "@repo/db";
import { processNextEligibleCall } from "../worker/processQueue.js";
import { getWorkspaceRoutingPolicyFromClient, isFooliooSystemContact, nextWorkspaceCallingTime } from "../services/workspaceConfiguration.js";
import { env } from "../config/env.js";

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
    humanRequested?: boolean;
    optOutRequested?: boolean;
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
        (analysis.humanRequested !== undefined && typeof analysis.humanRequested !== "boolean") ||
        (analysis.optOutRequested !== undefined && typeof analysis.optOutRequested !== "boolean") ||
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
        customFields: contacts.customFields,
      })
      .from(contacts)
      .where(and(eq(contacts.id, payload.contactId), eq(contacts.clientId, payload.clientId)))
      .limit(1);

    if (!client || !contact) {
      return { notFound: true as const };
    }

    const isPublicDemoContact = Boolean(
      contact.customFields && typeof contact.customFields === "object" && !Array.isArray(contact.customFields) &&
      (contact.customFields as Record<string, unknown>)._fooliooSystem === "public_demo"
    );

    // Public demos are not recorded. Do not retain the visitor's number in the call log,
    // transcript, summary or analysis fields. The contact row keeps the number only for
    // the 24-hour anti-abuse cooldown and is redacted by the periodic cleanup task.
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
        phoneNumber: isPublicDemoContact ? null : contact?.phoneNumber ?? null,
        attemptNumber,
        startedAt,
        endedAt,
        durationSeconds: payload.durationSeconds ?? 0,
        outcome,
        isBillable,
        creditsCharged,
        summary: isPublicDemoContact ? null : analysis?.summary ?? null,
        interestLevel: isPublicDemoContact ? null : analysis?.interestLevel ?? null,
        sentiment: isPublicDemoContact ? null : analysis?.sentiment ?? null,
        objectionsRaised: isPublicDemoContact ? null : analysis?.objectionsRaised ?? null,
        followUpRequested: isPublicDemoContact ? false : Boolean(analysis?.followUpRequested || analysis?.requestedCallbackTime || analysis?.humanRequested),
        costTelephony,
        costStt,
        costLlm,
        costTts,
        costTotal,
        recordingUrl: isPublicDemoContact ? null : payload.recording?.available ? payload.recording.storageKey ?? null : null,
        transcript: isPublicDemoContact ? null : payload.transcript,
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
        if (!isPublicDemoContact && payload.recording?.available && payload.recording.storageKey) {
          try {
            await tx
              .update(calls)
              .set({ recordingUrl: payload.recording.storageKey })
              .where(eq(calls.id, duplicate.id));

            await tx.insert(callRecordings).values({
              callId: duplicate.id,
              clientId: payload.clientId,
              sourceUrl: payload.recording.storageKey,
              durationSeconds: payload.recording.durationSeconds ?? payload.durationSeconds ?? null,
              fileFormat: "mp3",
              fileSizeBytes: payload.recording.sizeBytes ?? null,
              status: "completed",
              channels: 1,
              metadata: {
                deliveryId: payload.deliveryId,
                plivoCallId: payload.plivoCallId,
                mimeType: payload.recording.mimeType || "audio/mp3",
              },
            }).onConflictDoNothing();
          } catch (dupRecErr) {
            console.warn("[calls/complete] Failed to attach recording to duplicate call:", dupRecErr);
          }
        }
        return { duplicate: true as const, callId: duplicate.id, creditsCharged: duplicate.creditsCharged };
      }
      throw new Error("Failed to insert call record");
    }

    // 1b. Record storage tracking in dedicated callRecordings table
    if (!isPublicDemoContact && payload.recording?.available && payload.recording.storageKey) {
      try {
        await tx.insert(callRecordings).values({
          callId: callRecord.id,
          clientId: payload.clientId,
          sourceUrl: payload.recording.storageKey,
          durationSeconds: payload.recording.durationSeconds ?? payload.durationSeconds ?? null,
          fileFormat: "mp3",
          fileSizeBytes: payload.recording.sizeBytes ?? null,
          status: "completed",
          channels: 1,
          metadata: {
            deliveryId: payload.deliveryId,
            plivoCallId: payload.plivoCallId,
            mimeType: payload.recording.mimeType || "audio/mp3",
          },
        });
      } catch (recErr) {
        console.warn("[calls/complete] Failed to record callRecording metadata:", recErr);
      }
    }

    // 2. Follow-up routing. Test calls are for the workspace owner and must
    // never create CRM follow-ups or trigger business routing automations.
    const isTestCall = Boolean(queueEntry && queueEntry.campaignId === null && isFooliooSystemContact(contact.customFields));
    const routingPolicy = getWorkspaceRoutingPolicyFromClient(client);
    const optOutRequested = !isTestCall && analysis?.optOutRequested === true;
    const contactOptedOut = contact.optOut || optOutRequested;

    // A caller's explicit opt-out is authoritative. Suppress every pending queue
    // item for this contact before any retry or follow-up routing can run.
    if (optOutRequested) {
      await tx.update(contacts)
        .set({ optOut: true, status: "do_not_call", updatedAt: new Date() })
        .where(and(eq(contacts.id, payload.contactId), eq(contacts.clientId, payload.clientId)));
      await tx.update(callQueue)
        .set({ status: "failed", reservedCredits: 0, updatedAt: new Date() })
        .where(and(
          eq(callQueue.contactId, payload.contactId),
          eq(callQueue.clientId, payload.clientId),
          eq(callQueue.status, "pending"),
        ));
    }

    let followUpId: string | null = null;
    const followUpIds: string[] = [];

    if (!isTestCall && analysis && !optOutRequested) {
      const callbackTriggered = routingPolicy.callback.enabled &&
        (analysis.followUpRequested || Boolean(analysis.requestedCallbackTime));
      const highInterestTriggered = routingPolicy.highInterest.enabled && analysis.interestLevel === "high";
      const humanRequestedTriggered = routingPolicy.humanRequested.enabled && analysis.humanRequested === true;

      // One actionable item per call avoids duplicate tasks when a caller asks
      // for a callback while also expressing strong interest. Human handoff is
      // the most urgent action, followed by an explicit callback, then interest.
      const selectedFollowUp = humanRequestedTriggered
        ? {
            type: "escalation",
            priority: "urgent",
            assignedTo: routingPolicy.humanRequested.assignToUserId,
            dueDate: new Date(Date.now() + 5 * 60_000),
            triggerNote: "The caller requested a human representative.",
          }
        : callbackTriggered
          ? {
              type: "call_back",
              priority: analysis.interestLevel === "high" ? "high" : "medium",
              assignedTo: routingPolicy.callback.assignToUserId,
              dueDate: analysis.requestedCallbackTime
                ? new Date(analysis.requestedCallbackTime)
                : new Date(Date.now() + routingPolicy.callback.dueInMinutes * 60_000),
              triggerNote: "A callback was requested during the call.",
            }
          : highInterestTriggered
            ? {
                type: "lead_follow_up",
                priority: "high",
                assignedTo: routingPolicy.highInterest.assignToUserId,
                dueDate: new Date(Date.now() + routingPolicy.callback.dueInMinutes * 60_000),
                triggerNote: "The call was classified as a high-interest lead.",
              }
            : null;

      if (selectedFollowUp) {
        let assignedTo: string | null = null;
        if (selectedFollowUp.assignedTo) {
          const [validOwner] = await tx.select({ id: users.id }).from(users)
            .where(and(eq(users.id, selectedFollowUp.assignedTo), eq(users.clientId, payload.clientId)))
            .limit(1);
          assignedTo = validOwner?.id ?? null;
        }

        const notes = [analysis.notes?.trim() || analysis.summary?.trim() || "Follow-up created from a completed call.", selectedFollowUp.triggerNote]
          .filter(Boolean).join("\n\n").slice(0, 5000);
        const [createdFollowUp] = await tx.insert(followUps).values({
          callId: callRecord.id,
          contactId: payload.contactId,
          clientId: payload.clientId,
          type: selectedFollowUp.type,
          priority: selectedFollowUp.priority,
          assignedTo,
          requestedCallbackTime: selectedFollowUp.type === "call_back" && analysis.requestedCallbackTime
            ? new Date(analysis.requestedCallbackTime)
            : null,
          dueDate: selectedFollowUp.dueDate,
          status: "open",
          notes,
        }).returning({ id: followUps.id });

        if (createdFollowUp) {
          followUpId = createdFollowUp.id;
          followUpIds.push(createdFollowUp.id);
          console.log(`[calls/complete] Created ${selectedFollowUp.type} follow-up ${createdFollowUp.id} for contact ${payload.contactId}`);
        }
      }
    }

    // 3. Update call_queue and contacts with retry or exhaustion logic
    let finalQueueStatus: "completed" | "pending" | "exhausted" | "failed" = "completed";
    let retryScheduledFor: Date | null = null;

    if (queueEntry) {
      const isConnected = outcome === "connected";
      const maxAttempts = Math.max(1, Math.min(queueEntry.maxAttempts ?? routingPolicy.noAnswer.maxAttempts, routingPolicy.noAnswer.maxAttempts));
      const currentAttempt = queueEntry.attemptNumber ?? 1;
      const isRetryable = !isTestCall && routingPolicy.noAnswer.enabled && payload.retryable !== false && !isConnected;

      if (isConnected) {
        finalQueueStatus = "completed";
        await tx
          .update(callQueue)
          .set({ status: "completed", reservedCredits: 0, updatedAt: new Date() })
          .where(and(eq(callQueue.id, queueEntry.id), eq(callQueue.status, "in_progress")));

        if (!contactOptedOut) {
          await tx
            .update(contacts)
            .set({ status: "completed", updatedAt: new Date() })
            .where(and(eq(contacts.id, payload.contactId), eq(contacts.clientId, payload.clientId)));
        }
      } else if (isRetryable && currentAttempt < maxAttempts && !contactOptedOut) {
        finalQueueStatus = "pending";
        const retryNotBefore = new Date(Date.now() + routingPolicy.noAnswer.retryAfterMinutes * 60_000);
        retryScheduledFor = nextWorkspaceCallingTime(retryNotBefore, routingPolicy.callingHours);

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

        if (!contactOptedOut) {
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
    console.log(`                 Contact: ${isPublicDemoContact ? "Public demo visitor" : `${contact?.fullName || payload.contactId} (${contact?.phoneNumber || "N/A"})`}`);
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
      followUpIds,
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
 * GET /api/calls/:id/transcript
 *
 * Returns a bounded transcript window so large call records do not have to be
 * serialized into the dashboard page response all at once.
 */
export async function getCallTranscriptRoute(req: Request, res: Response) {
  const { id } = req.params;
  const offsetValue = req.query.offset ?? "0";
  const limitValue = req.query.limit ?? "20";
  const offset = typeof offsetValue === "string" && /^\d+$/.test(offsetValue)
    ? Number(offsetValue)
    : Number.NaN;
  const limit = typeof limitValue === "string" && /^\d+$/.test(limitValue)
    ? Number(limitValue)
    : Number.NaN;

  if (
    !id ||
    !req.clientId ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > 2000 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 20
  ) {
    return res.status(400).json({ ok: false, error: "Invalid transcript pagination parameters" });
  }

  try {
    const transcriptArray = sql`case
      when jsonb_typeof(${calls.transcript}) = 'array' then ${calls.transcript}
      else '[]'::jsonb
    end`;
    const [call] = await db
      .select({
        total: sql<number>`jsonb_array_length(${transcriptArray})::int`,
        transcript: sql<unknown[]>`coalesce((
          select jsonb_agg(entry order by ordinal)
          from jsonb_array_elements(${transcriptArray}) with ordinality as transcript_items(entry, ordinal)
          where ordinal > ${offset} and ordinal <= ${offset + limit}
        ), '[]'::jsonb)`,
      })
      .from(calls)
      .where(and(eq(calls.id, id), eq(calls.clientId, req.clientId)))
      .limit(1);

    if (!call) {
      return res.status(404).json({ ok: false, error: `Call with ID ${id} not found` });
    }

    return res.json({
      ok: true,
      transcript: call.transcript,
      total: call.total,
      offset,
      limit,
    });
  } catch (err: unknown) {
    console.error("[calls/transcript] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * GET /api/calls/live
 *
 * Lightweight workspace-scoped status for active queue entries. This endpoint
 * intentionally returns no transcript, recordings, summaries or call history.
 */
export async function getLiveCallsRoute(req: Request, res: Response) {
  try {
    const clientId = req.clientId;
    if (!clientId) return res.status(401).json({ ok: false, error: "Workspace context is required." });

    const entries = await db
      .select({
        id: callQueue.id,
        contactName: callQueue.contactName,
        phoneNumber: callQueue.phoneNumber,
        status: callQueue.status,
        scheduledFor: callQueue.scheduledFor,
        updatedAt: callQueue.updatedAt,
        campaignName: campaigns.name,
      })
      .from(callQueue)
      .leftJoin(campaigns, eq(callQueue.campaignId, campaigns.id))
      .where(and(
        eq(callQueue.clientId, clientId),
        inArray(callQueue.status, ["pending", "in_progress"]),
      ))
      .orderBy(desc(callQueue.updatedAt))
      .limit(50);

    const [counts] = await db
      .select({
        pendingCount: sql<number>`count(*) filter (where ${callQueue.status} = 'pending')::int`,
        inProgressCount: sql<number>`count(*) filter (where ${callQueue.status} = 'in_progress')::int`,
      })
      .from(callQueue)
      .where(and(
        eq(callQueue.clientId, clientId),
        inArray(callQueue.status, ["pending", "in_progress"]),
      ));

    return res.json({
      ok: true,
      pendingCount: counts?.pendingCount ?? 0,
      inProgressCount: counts?.inProgressCount ?? 0,
      entries,
    });
  } catch (err: unknown) {
    console.error("[calls/live] Unable to load live call status:", err);
    return res.status(500).json({ ok: false, error: "Live call status could not be loaded." });
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

    const includeTranscript = req.query.includeTranscript !== "false";
    const callFields = {
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
      ...(includeTranscript ? { transcript: calls.transcript } : {}),
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
    };

    const [callItem] = await db
      .select(callFields)
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

/**
 * Returns metadata and the streaming playback URL for a call's voice recording.
 * Enforces workspace/client ownership.
 */
export async function getCallRecordingRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Call ID is required" });
    }

    const [rec] = await db
      .select({
        id: callRecordings.id,
        callId: callRecordings.callId,
        sourceUrl: callRecordings.sourceUrl,
        durationSeconds: callRecordings.durationSeconds,
        fileFormat: callRecordings.fileFormat,
        status: callRecordings.status,
        createdAt: callRecordings.createdAt,
      })
      .from(callRecordings)
      .where(and(eq(callRecordings.callId, id), eq(callRecordings.clientId, req.clientId!)))
      .limit(1);

    if (rec) {
      return res.json({
        ok: true,
        available: true,
        recording: {
          ...rec,
          streamUrl: `/api/calls/${id}/recording/stream`,
        },
      });
    }

    // Fallback: check legacy/direct calls.recordingUrl
    const [callItem] = await db
      .select({
        id: calls.id,
        recordingUrl: calls.recordingUrl,
        durationSeconds: calls.durationSeconds,
        createdAt: calls.createdAt,
      })
      .from(calls)
      .where(and(eq(calls.id, id), eq(calls.clientId, req.clientId!)))
      .limit(1);

    if (callItem?.recordingUrl) {
      return res.json({
        ok: true,
        available: true,
        recording: {
          id: callItem.id,
          callId: callItem.id,
          sourceUrl: callItem.recordingUrl,
          durationSeconds: callItem.durationSeconds,
          fileFormat: "mp3",
          status: "completed",
          streamUrl: `/api/calls/${id}/recording/stream`,
          createdAt: callItem.createdAt,
        },
      });
    }

    return res.json({
      ok: true,
      available: false,
      recording: null,
      message: "No voice recording available for this call",
    });
  } catch (err: unknown) {
    console.error("[calls/recording/get] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * Streams the call's audio recording with full HTTP Range request support (HTTP 206 Partial Content).
 * Seamlessly authenticates with Plivo using server-side credentials when media URLs are protected,
 * allowing frontend HTML5 <audio> players to seek and stream smoothly without CORS or auth issues.
 */
export async function streamCallRecordingRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Call ID is required" });
    }

    // 1. Look up recording URL for this call belonging to the tenant
    const [rec] = await db
      .select({
        id: callRecordings.id,
        sourceUrl: callRecordings.sourceUrl,
        fileFormat: callRecordings.fileFormat,
      })
      .from(callRecordings)
      .where(and(eq(callRecordings.callId, id), eq(callRecordings.clientId, req.clientId!)))
      .limit(1);

    let audioUrl = rec?.sourceUrl;
    if (!audioUrl) {
      const [callItem] = await db
        .select({ recordingUrl: calls.recordingUrl })
        .from(calls)
        .where(and(eq(calls.id, id), eq(calls.clientId, req.clientId!)))
        .limit(1);
      audioUrl = callItem?.recordingUrl ?? undefined;
    }

    if (!audioUrl) {
      return res.status(404).json({ ok: false, error: "No recording available for this call" });
    }

    // 2. Prepare headers for upstream audio request
    const upstreamHeaders: Record<string, string> = {};
    if (req.headers.range) {
      upstreamHeaders["Range"] = req.headers.range;
    }

    // If source is a Plivo media URL, inject server Basic Auth credentials
    const isPlivoUrl = audioUrl.includes("plivo.com");
    if (isPlivoUrl && env.plivo?.authId && env.plivo?.authToken) {
      const basicAuth = Buffer.from(`${env.plivo.authId}:${env.plivo.authToken}`).toString("base64");
      upstreamHeaders["Authorization"] = `Basic ${basicAuth}`;
    }

    // 3. Fetch audio stream from provider
    const upstreamRes = await fetch(audioUrl, {
      method: "GET",
      headers: upstreamHeaders,
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      console.error(`[calls/recording/stream] Provider fetch error: ${upstreamRes.status} ${upstreamRes.statusText}`);
      return res.status(upstreamRes.status).json({
        ok: false,
        error: `Provider audio stream error (${upstreamRes.status})`,
      });
    }

    // 4. Forward audio headers to frontend client
    res.status(upstreamRes.status);
    const contentType = upstreamRes.headers.get("content-type") || "audio/mpeg";
    const contentLength = upstreamRes.headers.get("content-length");
    const contentRange = upstreamRes.headers.get("content-range");
    const acceptRanges = upstreamRes.headers.get("accept-ranges") || "bytes";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", acceptRanges);
    if (contentLength) res.setHeader("Content-Length", contentLength);
    if (contentRange) res.setHeader("Content-Range", contentRange);

    // Private cache-control for call security
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate");

    // 5. Pipe response stream to client
    if (!upstreamRes.body) {
      return res.end();
    }

    const { Readable } = await import("node:stream");
    const nodeStream = Readable.fromWeb(upstreamRes.body as any);
    nodeStream.pipe(res);

    req.on("close", () => {
      nodeStream.destroy();
    });
  } catch (err: unknown) {
    console.error("[calls/recording/stream] Streaming error:", err);
    if (!res.headersSent) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: message });
    }
  }
}

/**
 * POST /api/calls/recording
 * Machine-to-machine webhook endpoint called when Plivo finishes MP3 processing.
 * Updates the existing call record and callRecordings table.
 */
export async function updateCallRecordingRoute(req: Request, res: Response) {
  const { deliveryId, plivoCallId, recordingUrl, durationSeconds } = req.body ?? {};

  if (!recordingUrl || (!deliveryId && !plivoCallId)) {
    return res.status(400).json({
      ok: false,
      error: "Missing required fields: recordingUrl and (deliveryId or plivoCallId)",
    });
  }

  try {
    let call = null;

    if (deliveryId) {
      const [found] = await db
        .select()
        .from(calls)
        .where(eq(calls.deliveryId, deliveryId))
        .limit(1);
      call = found;
    }

    if (!call && plivoCallId) {
      const [found] = await db
        .select()
        .from(calls)
        .where(eq(calls.deliveryId, plivoCallId))
        .limit(1);
      call = found;
    }

    if (!call) {
      console.warn(`[calls/recording] No call matching deliveryId=${deliveryId} or plivoCallId=${plivoCallId}`);
      return res.status(404).json({ ok: false, error: "Call record not found" });
    }

    // 1. Update call row with recordingUrl
    await db
      .update(calls)
      .set({ recordingUrl })
      .where(eq(calls.id, call.id));

    // 2. Insert into callRecordings table
    await db
      .insert(callRecordings)
      .values({
        callId: call.id,
        clientId: call.clientId,
        sourceUrl: recordingUrl,
        durationSeconds: durationSeconds ?? call.durationSeconds ?? null,
        fileFormat: "mp3",
        status: "completed",
        channels: 1,
        metadata: {
          deliveryId,
          plivoCallId,
        },
      })
      .onConflictDoNothing();

    console.log(`[calls/recording] ✅ Attached recording URL to call ${call.id}`);
    return res.json({ ok: true, callId: call.id });
  } catch (err: unknown) {
    console.error("[calls/recording] Error attaching recording:", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
