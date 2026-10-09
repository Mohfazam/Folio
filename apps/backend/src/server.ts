import type { Server } from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env, isOriginAllowed, validateEnv } from "./config/env.js";
import { registerRoutes } from "./routes/index.js";
import { pool } from "./config/db.js";
import { globalRateLimiter } from "./middleware/rateLimiters.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { setShuttingDown } from "./routes/health.js";
import { processNextEligibleCall } from "./worker/processQueue.js";

export function createApp(): express.Express {
  validateEnv();

  const app = express();

  // Production-grade security headers
  app.use(
    helmet({
      contentSecurityPolicy: false, // APIs do not serve interactive HTML; avoid breaking API callers
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  // CORS whitelist handler
  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS error: Origin ${origin} is not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Webhook-Secret",
      "X-Requested-With",
      "Accept",
    ],
    maxAge: 86400, // 24 hours preflight cache
  };
  app.use(cors(corsOptions));

  // Global rate limiter (skips /health checks and test suite)
  app.use(globalRateLimiter);

  // Hardened request body limits (1MB default for JSON payloads)
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // Application routes
  registerRoutes(app);

  // Centralized 404 handler for unrecognized routes
  app.use(notFoundHandler);

  // Centralized error handling
  app.use(errorHandler);

  return app;
}

export interface RunningServer {
  app: express.Express;
  server: Server;
  stop: () => Promise<void>;
}

export function startServer(): RunningServer {
  const app = createApp();
  let queueInterval: NodeJS.Timeout | null = null;
  let isClosing = false;

  const server = app.listen(env.port, "0.0.0.0", () => {
    console.log(`[backend] 🚀 Backend service running on port ${env.port} (${env.nodeEnv})`);

    // Trigger initial check on startup
    void processNextEligibleCall().catch((err) => {
      console.error("[backend] Initial queue processing error:", err);
    });

    // Background interval: check every 20 seconds for pending/scheduled calls
    const QUEUE_POLL_INTERVAL_MS = 20_000;
    queueInterval = setInterval(() => {
      void processNextEligibleCall().catch((err) => {
        console.error("[backend] Periodic queue runner error:", err);
      });
    }, QUEUE_POLL_INTERVAL_MS);
  });

  const stop = async (): Promise<void> => {
    if (isClosing) return;
    isClosing = true;

    setShuttingDown(true);
    console.log("[backend] 🛑 Initiating graceful shutdown...");

    if (queueInterval) {
      clearInterval(queueInterval);
      queueInterval = null;
    }

    await new Promise<void>((resolve) => {
      server.close((err) => {
        if (err) {
          console.error("[backend] Error closing HTTP server:", err);
        } else {
          console.log("[backend] HTTP server closed.");
        }
        resolve();
      });
    });

    try {
      await pool.end();
      console.log("[backend] Database pool drained.");
    } catch (err) {
      console.error("[backend] Error draining database pool:", err);
    }
  };

  const handleSignal = (signal: string) => {
    console.log(`[backend] Received ${signal}. Draining connections...`);
    const shutdownTimeout = setTimeout(() => {
      console.error("[backend] Graceful shutdown timed out (10s). Forcing process exit.");
      process.exit(1);
    }, 10_000);
    shutdownTimeout.unref();

    void stop()
      .then(() => {
        clearTimeout(shutdownTimeout);
        console.log("[backend] Graceful shutdown completed cleanly.");
        process.exit(0);
      })
      .catch((err) => {
        console.error("[backend] Error during shutdown:", err);
        process.exit(1);
      });
  };

  process.once("SIGTERM", () => handleSignal("SIGTERM"));
  process.once("SIGINT", () => handleSignal("SIGINT"));

  return { app, server, stop };
}
