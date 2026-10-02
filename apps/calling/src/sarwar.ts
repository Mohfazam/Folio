import { createServer } from "node:http";
import express from "express";
import cors from "cors";
import { registerRoutes } from "./routes/index.js";
import { attachMediaStream } from "./routes/media-stream.js";
import { activeCallRegistry } from "./session/ActiveCallRegistry.js";

export function startServer() {
  const app = express();

  // Middleware for cross-origin requests and webhook body parsing
  app.use(cors());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  registerRoutes(app);

  const server = createServer(app);
  attachMediaStream(server);

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] 🚀 Calling service running on port ${PORT}`);
  });

  // ── Graceful shutdown ──────────────────────────────────────────────
  // On SIGTERM (Railway/Fly.io deploy), cleanly finalize active calls
  // so transcripts/webhooks are delivered before the process exits.
  let shuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`[server] 🛑 ${signal} received — initiating graceful shutdown...`);

    const activeCalls = activeCallRegistry.getAllActive();
    if (activeCalls.length > 0) {
      console.log(`[server] ⚠️ ${activeCalls.length} active call(s) in progress — marking as interrupted...`);
      for (const call of activeCalls) {
        activeCallRegistry.markEnded(
          call.requestId,
          "interrupted",
          `Server shutdown (${signal})`
        );
      }

      // Give 3 seconds for webhook deliveries to fire
      console.log(`[server] ⏳ Waiting 3s for webhook deliveries...`);
      await new Promise((r) => setTimeout(r, 3000));
    }

    server.close(() => {
      console.log(`[server] 👋 HTTP server closed. Goodbye.`);
      process.exit(0);
    });

    // Force exit after 8 seconds if server.close() hangs (WebSocket clients holding connections)
    setTimeout(() => {
      console.warn(`[server] ⚠️ Forced exit after 8s timeout`);
      process.exit(1);
    }, 8000).unref();
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  return server;
}