import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { callQueue, clients } from "@repo/db";

let isCleaningQueue = false;

/**
 * 24/7 Background Task:
 * Cleans the call queue by finding "zombie" entries stuck in "in_progress" status
 * for more than 15 minutes (the hard ceiling for any Plivo phone call).
 *
 * When found:
 * 1. Releases reserved client credits so clients are never unfairly locked out.
 * 2. Marks the queue item as "failed" with a clear diagnostic reason.
 */
export async function cleanStaleQueueEntries(): Promise<{
  cleanedCount: number;
}> {
  if (isCleaningQueue) {
    return { cleanedCount: 0 };
  }

  isCleaningQueue = true;

  try {
    // 15 minutes ago (Plivo enforces a 15-minute maximum call duration limit)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    const staleEntries = await db
      .select({
        id: callQueue.id,
        clientId: callQueue.clientId,
        reservedCredits: callQueue.reservedCredits,
        updatedAt: callQueue.updatedAt,
      })
      .from(callQueue)
      .where(and(eq(callQueue.status, "in_progress"), lt(callQueue.updatedAt, fifteenMinutesAgo)))
      .limit(50);

    if (staleEntries.length === 0) {
      return { cleanedCount: 0 };
    }

    console.log(`[queue-cleaner-worker] 🧹 Found ${staleEntries.length} zombie queue entries stuck in_progress`);

    let cleanedCount = 0;

    for (const entry of staleEntries) {
      try {
        await db.transaction(async (tx) => {
          // 1. Mark queue entry as failed / timed out
          await tx
            .update(callQueue)
            .set({
              status: "failed",
              reservedCredits: 0,
              updatedAt: new Date(),
            })
            .where(eq(callQueue.id, entry.id));

          // 2. Release reserved credits on the client
          if (entry.reservedCredits > 0) {
            await tx
              .update(clients)
              .set({
                creditsReservedThisCycle: sql`greatest(0, ${clients.creditsReservedThisCycle} - ${entry.reservedCredits})`,
                updatedAt: new Date(),
              })
              .where(eq(clients.id, entry.clientId));
          }
        });

        cleanedCount++;
        console.log(`[queue-cleaner-worker] 🔄 Cleaned stale queue item ${entry.id} (released ${entry.reservedCredits} credits)`);
      } catch (entryErr) {
        console.error(`[queue-cleaner-worker] Error cleaning stale entry ${entry.id}:`, entryErr);
      }
    }

    return { cleanedCount };
  } catch (err: unknown) {
    console.error("[queue-cleaner-worker] Error during queue cleanup cycle:", err);
    return { cleanedCount: 0 };
  } finally {
    isCleaningQueue = false;
  }
}
