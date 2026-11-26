import { env } from "../config/env.js";
import { workerMetrics } from "../metrics/registry.js";

interface CleanupResponse {
  ok: boolean;
  zombieCleanedCount?: number;
  completedPurgedCount?: number;
  totalCleaned?: number;
  error?: string;
}

export async function triggerQueueCleanup(): Promise<{
  zombiesCleaned: number;
  completedPurged: number;
}> {
  try {
    const cleanupUrl = `${env.backendUrl}/api/worker/queue/cleanup`;
    const res = await fetch(cleanupUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Folio-Worker/1.0",
        ...(env.workerSecret ? { "x-worker-secret": env.workerSecret } : {}),
        ...(env.workerSecret ? { Authorization: `Bearer ${env.workerSecret}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      const errMsg = `Backend queue cleanup returned ${res.status}: ${errText.slice(0, 100)}`;
      console.warn(`[queue-cleaner] ⚠️ ${errMsg}`);
      workerMetrics.recordQueueError(errMsg);
      return { zombiesCleaned: 0, completedPurged: 0 };
    }

    const data = (await res.json()) as CleanupResponse;
    const zombies = data.zombieCleanedCount ?? 0;
    const purged = data.completedPurgedCount ?? 0;

    workerMetrics.recordQueueCleanup(zombies, purged);

    if (zombies > 0 || purged > 0) {
      console.log(`[queue-cleaner] 🧹 Cleaned queue: ${zombies} zombie calls fixed, ${purged} completed records purged`);
    }

    return { zombiesCleaned: zombies, completedPurged: purged };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[queue-cleaner] Cleanup error:", msg);
    workerMetrics.recordQueueError(msg);
    return { zombiesCleaned: 0, completedPurged: 0 };
  }
}
