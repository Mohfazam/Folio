import type { Express } from "express";
import { dialRoute, activeCallsRoute } from "./dial.js";
import { plivoVoiceRoute } from "./plivo-voice.js";
import { plivoHangupRoute } from "./plivo-hangup.js";
import { metricsRoute } from "./metrics.js";
import { activeCallRegistry } from "../session/ActiveCallRegistry.js";

export function registerRoutes(app: Express) {
  // Voice call webhook (Plivo calls this when recipient answers)
  app.post("/plivo-voice", plivoVoiceRoute);
  app.get("/plivo-voice", plivoVoiceRoute);

  // Hangup webhook (Plivo calls this when call ends or fails)
  app.post("/plivo-hangup", plivoHangupRoute);
  app.get("/plivo-hangup", plivoHangupRoute);

  // Dial routes (initiate outbound calls)
  app.get("/dial", dialRoute);
  app.post("/dial", dialRoute);

  // Active call monitoring & diagnostics
  app.get("/active-calls", activeCallsRoute);

  // Comprehensive metrics & monitoring
  app.get("/metrics", metricsRoute);

  // Health check endpoint
  app.get("/health", (_req, res) => {
    const active = activeCallRegistry.getAllActive();
    res.json({
      status: "healthy",
      uptime: process.uptime(),
      activeCalls: active.length,
      timestamp: new Date().toISOString(),
    });
  });
}
