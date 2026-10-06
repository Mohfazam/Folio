import type { Request, Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { calls, callQueue, clients, contacts, followUps } from "@repo/db";
import { processNextEligibleCall } from "../worker/processQueue.js";
import { calculateNextRetrySchedule } from "../utils/retrySchedule.js";

/**
 * The shape posted by /apps/calling's dispatchCallCompleted (see callTypes.ts → CallResult).
 * This interface mirrors every field that /calling's CallSessionState.buildResult() produces.
 * We intentionally accept the full payload and extract what we need for the `calls` table.
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
  startedAt: string;  // ISO 8601
  endedAt: string;    // ISO 8601
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
}

/**
 * Maps the calling service's CallStatus to the DB's call_outcome enum values.
 * DB enum: 'connected' | 'no_answer' | 'busy' | 'voicemail' | 'dropped_early' | 'failed'
 */
function mapStatusToOutcome(status: CallingServicePayload["status"]): "connected" | "no_answer" | "busy" | "voicemail" | "dropped_early" | "failed" {
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
 * after a call finishes. The payload shape is defined by CallResult in
 * /apps/calling/src/types/callTypes.ts and built by CallSessionState.buildResult().
 *
 * Steps:
 * 1. Look up originating queueEntry and client
 * 2. Insert call record into `calls`
 * 3. Ingest follow-up into `follow_ups` if requested
 * 4. Update `call_queue` with completion or retry/exhaustion logic
 * 5. Update client counters (creditsUsedThisCycle)
 * 6. Trigger the queue worker for the next eligible call
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

    console.log(`[calls/complete] 📥 Received call webhook: contactId=${payload.contactId}, status=${payload.status}, duration=${payload.durationSeconds}s`);

    const outcome = mapStatusToOutcome(payload.status);
    const isBillable = outcome === "connected";

    // Compute credits: ceil(durationSeconds / 10)
    // The calling service does NOT send creditsCharged — we compute it here.
    const creditsCharged = isBillable
      ? Math.ceil((payload.durationSeconds || 0) / 10)
      : 0;

    // Extract analysis fields (if the AI post-call analysis ran)
    const analysis = payload.analysis;

    // Find the queue entry this call belongs to — match by contactId + clientId + in_progress status
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

    // Look up client for calling hours / timezone in retry scheduling
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, payload.clientId))
      .limit(1);

    // Look up the contact to get name and phone for denormalization
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

    // 2. Follow-up ingestion: insert into follow_ups if requested by caller or post-call AI analysis
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
        // Call connected and succeeded
        finalQueueStatus = "completed";
        await db
          .update(callQueue)
          .set({
            status: "completed",
            updatedAt: new Date(),
          })
          .where(eq(callQueue.id, queueEntry.id));

        await db
          .update(contacts)
          .set({
            status: "completed",
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, payload.contactId));
      } else if (isRetryable && currentAttempt < maxAttempts) {
        // Unanswered, busy, or dropped call eligible for retry
        finalQueueStatus = "pending";
        retryScheduledFor = calculateNextRetrySchedule(
          client?.timezone ?? "Asia/Kolkata",
          client?.callingHoursStart,
          client?.callingHoursEnd,
          2 // 2-hour retry delay
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
          .set({
            status: "queued",
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, payload.contactId));

        console.log(
          `[calls/complete] 🔄 Scheduled retry attempt ${currentAttempt + 1} of ${maxAttempts} for contact ${payload.contactId} at ${retryScheduledFor.toISOString()}`
        );
      } else {
        // All attempts exhausted or non-retryable failure
        finalQueueStatus = "exhausted";
        await db
          .update(callQueue)
          .set({
            status: "exhausted",
            updatedAt: new Date(),
          })
          .where(eq(callQueue.id, queueEntry.id));

        await db
          .update(contacts)
          .set({
            status: "completed",
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, payload.contactId));

        console.log(
          `[calls/complete] 🛑 Call attempts exhausted (${currentAttempt}/${maxAttempts}) for contact ${payload.contactId}`
        );
      }
    }

    // 4. Update client billing counters
    if (isBillable && creditsCharged > 0) {
      await db
        .update(clients)
        .set({
          creditsUsedThisCycle: sql`${clients.creditsUsedThisCycle} + ${creditsCharged}`,
          updatedAt: new Date(),
        })
        .where(eq(clients.id, payload.clientId));
    }

    // 5. Fire-and-forget: trigger the queue worker for the next eligible call
    void processNextEligibleCall().catch((err) => {
      console.error("[calls/complete] Worker trigger error:", err);
    });

    return res.status(201).json({
      ok: true,
      callId: callRecord.id,
      queueStatus: finalQueueStatus,
      retryScheduledFor: retryScheduledFor ? retryScheduledFor.toISOString() : undefined,
      followUpId: followUpId ?? undefined,
    });
  } catch (err: unknown) {
    console.error("[calls/complete] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
