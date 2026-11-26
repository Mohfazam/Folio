import { env } from "./config/env.js";
import { createWorkerServer } from "./server.js";
import { workerMetrics } from "./metrics/registry.js";
import { collectAndForwardPlivoRecordings } from "./services/plivoCollector.js";
import { triggerQueueCleanup } from "./services/queueCleaner.js";

const app = createWorkerServer();

let isRunningTask = false;
let cycleCounter = 0;
let pollTimer: NodeJS.Timeout | null = null;

async function executeCycle() {
  if (isRunningTask) return;
  isRunningTask = true;
  cycleCounter++;
  workerMetrics.recordCycle();

  try {
    // 1. Harvest & ingest Plivo recordings on every cycle
    await collectAndForwardPlivoRecordings();

    // 2. Clean call queue every 3 cycles (~60 seconds)
    if (cycleCounter % 3 === 0) {
      await triggerQueueCleanup();
    }
  } catch (err: unknown) {
    console.error("[worker-daemon] Unhandled error during worker cycle:", err);
  } finally {
    isRunningTask = false;
  }
}

const server = app.listen(env.port, "0.0.0.0", () => {
  console.log(`[folio-worker] 🚀 24/7 Worker Service running on port ${env.port}`);
  console.log(`[folio-worker] 📡 Connected to backend at: ${env.backendUrl}`);
  console.log(`[folio-worker] 📊 Metrics endpoint ready at: http://0.0.0.0:${env.port}/metrics`);
  console.log(`[folio-worker] ⏱️ Polling interval: ${env.pollIntervalMs}ms`);

  // Run first cycle immediately
  void executeCycle();

  // Start background interval
  pollTimer = setInterval(() => {
    void executeCycle();
  }, env.pollIntervalMs);
  pollTimer.unref();
});

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(`[folio-worker] 🛑 Received ${signal}. Shutting down worker...`);
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  server.close(() => {
    console.log("[folio-worker] Worker HTTP server closed.");
    process.exit(0);
  });

  // Force exit after 5s timeout
  setTimeout(() => process.exit(1), 5000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("[folio-worker] Unhandled Rejection:", reason);
});
