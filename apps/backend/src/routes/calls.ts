import type { Request, Response } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { calls, callQueue, clients, contacts } from "@repo/db";
import { processNextEligibleCall } from "../worker/processQueue.js";

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
 * Maps the calling service's CallStatus to the DB's queue_status enum values.
 * DB enum: 'pending' | 'in_progress' | 'completed' | 'failed' | 'exhausted'
 */
function mapStatusToQueueStatus(status: CallingServicePayload["status"]): "completed" | "failed" {
  switch (status) {
    case "completed":
      return "completed";
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
 * 1. Insert a row into `calls`
 * 2. Update the originating `call_queue` entry
 * 3. Update client counters (creditsUsedThisCycle, callsMadeToday)
 * 4. Trigger the queue worker for the next eligible call
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

    // Compute credits: ceil(durationSeconds / 10)
    // The calling service does NOT send creditsCharged — we compute it here.
    const creditsCharged = isBillable
      ? Math.ceil((payload.durationSeconds || 0) / 10)
      : 0;

    // Extract analysis fields (if the AI post-call analysis ran)
    const analysis = payload.analysis;

    // Find the queue entry this call belongs to — match by contactId + clientId + in_progress status
    // since /calling doesn't send the queueEntryId directly
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

    // 2. Update the call_queue entry
    if (queueEntry) {
      const newQueueStatus = mapStatusToQueueStatus(payload.status);
      await db
        .update(callQueue)
        .set({
          status: newQueueStatus,
          updatedAt: new Date(),
        })
        .where(eq(callQueue.id, queueEntry.id));
    }

    // 3. Update client counters
    if (isBillable && creditsCharged > 0) {
      await db
        .update(clients)
        .set({
          creditsUsedThisCycle: sql`${clients.creditsUsedThisCycle} + ${creditsCharged}`,
          updatedAt: new Date(),
        })
        .where(eq(clients.id, payload.clientId));
    }

    // callsMadeToday was already incremented by the worker when it initiated
    // the call, so we don't increment it again here.

    // 4. Fire-and-forget: trigger the queue worker for the next eligible call
    void processNextEligibleCall().catch((err) => {
      console.error("[calls/complete] Worker trigger error:", err);
    });

    return res.status(201).json({
      ok: true,
      callId: callRecord.id,
    });
  } catch (err: unknown) {
    console.error("[calls/complete] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
