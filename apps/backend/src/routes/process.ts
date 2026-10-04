import type { Request, Response } from "express";
import { processNextEligibleCall } from "../worker/processQueue.js";

/**
 * POST /api/queue/process
 *
 * Manual / cron safety-net trigger for the queue worker.
 *
 * This endpoint is meant to be called every 1–2 minutes by an external
 * scheduler (e.g. Railway cron job) as a backup to the event-driven trigger
 * in POST /api/calls/complete. It ensures the queue is always drained even
 * if a webhook is missed or the service restarts.
 *
 * Calling this when no contacts are eligible is a harmless no-op — it will
 * return { ok: true, result: "no_eligible_calls" }.
 */
export async function processQueueRoute(req: Request, res: Response) {
  try {
    const result = await processNextEligibleCall();
    return res.json({ ok: true, result });
  } catch (err: unknown) {
    console.error("[queue/process] Worker error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
