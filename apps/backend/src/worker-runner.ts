import { createWorkerDaemon } from "./worker/workerDaemon.js";
import { pool } from "./config/db.js";
import { validateEnv } from "./config/env.js";

// Validate environment variables on startup
validateEnv();

console.log("[worker-runner] 🚀 Initializing standalone Folio 24/7 Worker Service...");

const daemon = createWorkerDaemon({
  intervalMs: 15_000,
  verbose: true,
});

daemon.start();

// Handle graceful shutdown signals
const shutdown = async (signal: string) => {
  console.log(`[worker-runner] Received ${signal}. Shutting down worker gracefully...`);
  await daemon.stop();
  try {
    await pool.end();
  } catch {}
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("[worker-runner] Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[worker-runner] Uncaught exception:", error);
});
