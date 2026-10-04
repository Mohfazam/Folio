import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { registerRoutes } from "./routes/index.js";
import { processNextEligibleCall } from "./worker/processQueue.js";

export function createApp(): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  registerRoutes(app);

  return app;
}

export function startServer(): express.Express {
  const app = createApp();

  app.listen(env.port, "0.0.0.0", () => {
    console.log(`[backend] 🚀 Backend service running on port ${env.port}`);

    // Trigger initial check on startup
    void processNextEligibleCall().catch((err) => {
      console.error("[backend] Initial queue processing error:", err);
    });

    // Background interval: check every 20 seconds for pending/scheduled calls
    const QUEUE_POLL_INTERVAL_MS = 20_000;
    setInterval(() => {
      void processNextEligibleCall().catch((err) => {
        console.error("[backend] Periodic queue runner error:", err);
      });
    }, QUEUE_POLL_INTERVAL_MS);
  });

  return app;
}
