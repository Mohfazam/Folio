import { processNextEligibleCall } from "./processQueue.js";
import { syncPendingRecordingsFromPlivo } from "./recordingSyncWorker.js";
import { cleanStaleQueueEntries } from "./queueCleanerWorker.js";
import { cleanupExpiredPublicDemoData } from "../services/publicDemoRetention.js";

export interface WorkerDaemonOptions {
  /** Interval in milliseconds between worker cycles. Default: 15,000 (15 seconds). */
  intervalMs?: number;
  /** Whether to log verbose heartbeat messages. Default: true. */
  verbose?: boolean;
}

export interface WorkerDaemon {
  start: () => void;
  stop: () => Promise<void>;
  runCycle: () => Promise<void>;
}

/**
 * Creates a unified 24/7 background worker daemon.
 *
 * Runs continuously to:
 * 1. Process eligible calls from the callQueue.
 * 2. Continuously pull & link recordings from Plivo API for calls missing audio.
 * 3. Clean up stale/zombie queue entries & release unneeded credit reservations.
 * 4. Redact expired public demo caller numbers after 24h retention window.
 */
export function createWorkerDaemon(options?: WorkerDaemonOptions): WorkerDaemon {
  const intervalMs = options?.intervalMs ?? 15_000;
  const verbose = options?.verbose ?? true;

  let timer: NodeJS.Timeout | null = null;
  let isRunning = false;
  let isShuttingDown = false;
  let cycleCount = 0;

  async function runCycle() {
    if (isRunning || isShuttingDown) return;
    isRunning = true;
    cycleCount++;

    try {
      // 1. Process next eligible calls from callQueue
      try {
        const queueResult = await processNextEligibleCall();
        if (queueResult.action === "dialed" && verbose) {
          console.log(`[worker-daemon] 📞 Processed queue entry: ${queueResult.queueEntryId}`);
        }
      } catch (queueErr) {
        console.error("[worker-daemon] Queue processing error:", queueErr);
      }

      // 2. Pull & link call recordings from Plivo API
      try {
        const recResult = await syncPendingRecordingsFromPlivo();
        if (recResult.syncedCount > 0) {
          console.log(`[worker-daemon] ⏺️ Linked ${recResult.syncedCount} new recordings from Plivo!`);
        }
      } catch (recErr) {
        console.error("[worker-daemon] Recording sync error:", recErr);
      }

      // 3. Clean stale queue entries every 4 cycles (~60 seconds)
      if (cycleCount % 4 === 0) {
        try {
          await cleanStaleQueueEntries();
        } catch (cleanErr) {
          console.error("[worker-daemon] Queue cleanup error:", cleanErr);
        }
      }

      // 4. Clean expired public demo data every 60 cycles (~15 minutes)
      if (cycleCount % 60 === 0) {
        try {
          await cleanupExpiredPublicDemoData();
        } catch (demoErr) {
          console.error("[worker-daemon] Public demo retention cleanup error:", demoErr);
        }
      }
    } finally {
      isRunning = false;
    }
  }

  function start() {
    if (timer) return;
    console.log(`[worker-daemon] ⚡ 24/7 Background Worker started (poll interval: ${intervalMs}ms)`);
    // Run first cycle immediately
    void runCycle();

    timer = setInterval(() => {
      void runCycle();
    }, intervalMs);
    timer.unref();
  }

  async function stop() {
    isShuttingDown = true;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    console.log("[worker-daemon] 🛑 Background Worker stopped.");
  }

  return {
    start,
    stop,
    runCycle,
  };
}
