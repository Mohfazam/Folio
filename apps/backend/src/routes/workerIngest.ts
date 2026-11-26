import type { Request, Response } from "express";
import { and, desc, eq, isNull, like, lt, or, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { calls, callRecordings, callQueue, clients } from "@repo/db";

export interface DiscoveredRecordingItem {
  callUuid?: string;
  recordingId?: string;
  recordingUrl: string;
  durationSeconds?: number;
  fileFormat?: string;
  toNumber?: string;
  fromNumber?: string;
  addTime?: string;
}

/**
 * POST /api/worker/recordings/ingest
 *
 * Dedicated ingestion endpoint called by the standalone /worker service.
 * Receives discovered Plivo recordings and matches them against database calls.
 * Authentication: requireWorkerSecret
 */
export async function ingestWorkerRecordingsRoute(req: Request, res: Response) {
  const { recordings } = req.body as { recordings?: DiscoveredRecordingItem[] };

  if (!Array.isArray(recordings) || recordings.length === 0) {
    return res.status(400).json({ ok: false, error: "Empty or invalid recordings array" });
  }

  try {
    // 1. Fetch unrecorded calls from the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const unrecordedCalls = await db
      .select({
        id: calls.id,
        clientId: calls.clientId,
        deliveryId: calls.deliveryId,
        phoneNumber: calls.phoneNumber,
        metadata: calls.metadata,
        startedAt: calls.startedAt,
        durationSeconds: calls.durationSeconds,
      })
      .from(calls)
      .where(and(isNull(calls.recordingUrl), sql`${calls.startedAt} >= ${sevenDaysAgo}`))
      .orderBy(desc(calls.startedAt))
      .limit(100);

    if (unrecordedCalls.length === 0) {
      return res.json({ ok: true, matchedCount: 0, totalReceived: recordings.length, message: "No unrecorded calls pending" });
    }

    let matchedCount = 0;

    for (const rec of recordings) {
      const callUuid = rec.callUuid;
      const recUrl = rec.recordingUrl;
      if (!recUrl) continue;

      // Find matching call
      const matched = unrecordedCalls.find((call) => {
        // Strategy 1: Plivo Call UUID in deliveryId
        if (callUuid && call.deliveryId && call.deliveryId.includes(callUuid)) {
          return true;
        }

        // Strategy 2: Plivo Call UUID in metadata
        if (
          callUuid &&
          call.metadata &&
          typeof call.metadata === "object" &&
          !Array.isArray(call.metadata) &&
          (call.metadata as Record<string, unknown>).plivoCallId === callUuid
        ) {
          return true;
        }

        // Strategy 3: Target phone number + timestamp within 10 minutes
        if (rec.toNumber && call.phoneNumber && rec.addTime) {
          const recTime = new Date(rec.addTime).getTime();
          const callTime = new Date(call.startedAt).getTime();
          const cleanRec = rec.toNumber.replace(/\D/g, "");
          const cleanCall = call.phoneNumber.replace(/\D/g, "");

          if (
            (cleanRec.endsWith(cleanCall) || cleanCall.endsWith(cleanRec)) &&
            Math.abs(recTime - callTime) <= 10 * 60 * 1000
          ) {
            return true;
          }
        }

        return false;
      });

      if (matched) {
        try {
          // 1. Update calls row
          await db
            .update(calls)
            .set({ recordingUrl: recUrl })
            .where(eq(calls.id, matched.id));

          // 2. Insert into callRecordings table
          await db
            .insert(callRecordings)
            .values({
              callId: matched.id,
              clientId: matched.clientId,
              sourceUrl: recUrl,
              plivoRecordingId: rec.recordingId ?? null,
              durationSeconds: rec.durationSeconds ?? matched.durationSeconds ?? null,
              fileFormat: rec.fileFormat || "mp3",
              status: "completed",
              channels: 1,
              metadata: {
                ingestedViaWorker: true,
                plivoCallId: callUuid,
                plivoRecordingId: rec.recordingId,
                ingestedAt: new Date().toISOString(),
              },
            })
            .onConflictDoNothing();

          matchedCount++;
          console.log(`[worker-ingest] ⏺️ Linked recording ${rec.recordingId || ""} to call ${matched.id}`);

          // Remove matched from memory list
          const idx = unrecordedCalls.indexOf(matched);
          if (idx !== -1) unrecordedCalls.splice(idx, 1);
        } catch (dbErr) {
          console.error(`[worker-ingest] Failed to link recording to call ${matched.id}:`, dbErr);
        }
      }
    }

    return res.json({
      ok: true,
      matchedCount,
      totalReceived: recordings.length,
      unresolvedCount: unrecordedCalls.length,
    });
  } catch (err: unknown) {
    console.error("[worker-ingest] Ingestion error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * POST /api/worker/queue/cleanup
 *
 * Dedicated queue cleaning endpoint called by the standalone /worker service.
 * Cleans up:
 * 1. Completed/exhausted queue entries whose call history is safely stored in calls table.
 * 2. Zombie calls stuck in_progress > 15 minutes, releasing their credit reservations.
 * Authentication: requireWorkerSecret
 */
export async function cleanupWorkerQueueRoute(req: Request, res: Response) {
  try {
    let zombieCleanedCount = 0;
    let completedPurgedCount = 0;

    // 1. Clean zombie in-progress calls (> 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const zombieEntries = await db
      .select({
        id: callQueue.id,
        clientId: callQueue.clientId,
        reservedCredits: callQueue.reservedCredits,
      })
      .from(callQueue)
      .where(and(eq(callQueue.status, "in_progress"), lt(callQueue.updatedAt, fifteenMinutesAgo)))
      .limit(50);

    for (const zombie of zombieEntries) {
      try {
        await db.transaction(async (tx) => {
          await tx
            .update(callQueue)
            .set({ status: "failed", reservedCredits: 0, updatedAt: new Date() })
            .where(eq(callQueue.id, zombie.id));

          if (zombie.reservedCredits > 0) {
            await tx
              .update(clients)
              .set({
                creditsReservedThisCycle: sql`greatest(0, ${clients.creditsReservedThisCycle} - ${zombie.reservedCredits})`,
                updatedAt: new Date(),
              })
              .where(eq(clients.id, zombie.clientId));
          }
        });
        zombieCleanedCount++;
      } catch (zErr) {
        console.error(`[worker-queue-cleanup] Error cleaning zombie ${zombie.id}:`, zErr);
      }
    }

    // 2. Clean completed/exhausted queue records whose history is already stored in calls
    // Keep 1 hour buffer so recent UI queries have continuity
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const completedOrExhaustedToDelete = await db
      .select({ id: callQueue.id })
      .from(callQueue)
      .where(
        and(
          sql`${callQueue.status} IN ('completed', 'failed', 'exhausted')`,
          lt(callQueue.updatedAt, oneHourAgo),
          sql`EXISTS (SELECT 1 FROM ${calls} WHERE ${calls.queueEntryId} = ${callQueue.id})`
        )
      )
      .limit(100);

    if (completedOrExhaustedToDelete.length > 0) {
      const idsToDelete = completedOrExhaustedToDelete.map((q) => q.id);
      for (const id of idsToDelete) {
        try {
          await db.transaction(async (tx) => {
            // Nullify foreign key reference in calls to satisfy constraint while keeping call history intact
            await tx
              .update(calls)
              .set({ queueEntryId: null })
              .where(eq(calls.queueEntryId, id));

            await tx.delete(callQueue).where(eq(callQueue.id, id));
          });
          completedPurgedCount++;
        } catch (delErr) {
          console.error(`[worker-queue-cleanup] Error deleting queue entry ${id}:`, delErr);
        }
      }
      console.log(`[worker-queue-cleanup] 🧹 Purged ${completedPurgedCount} completed queue records already stored in calls`);
    }

    return res.json({
      ok: true,
      zombieCleanedCount,
      completedPurgedCount,
      totalCleaned: zombieCleanedCount + completedPurgedCount,
    });
  } catch (err: unknown) {
    console.error("[worker-queue-cleanup] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
