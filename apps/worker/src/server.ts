import express from "express";
import { workerMetrics } from "./metrics/registry.js";
import { collectAndForwardPlivoRecordings } from "./services/plivoCollector.js";
import { triggerQueueCleanup } from "./services/queueCleaner.js";

export function createWorkerServer(): express.Express {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      service: "folio-worker",
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/", (_req, res) => {
    res.json({
      service: "folio-worker",
      description: "24/7 background worker for Plivo recording harvesting and call queue maintenance",
      endpoints: ["/metrics", "/health", "/trigger"],
    });
  });

  // Dedicated /metrics endpoint for monitoring and Prometheus integration
  app.get("/metrics", (req, res) => {
    const accept = req.headers.accept || "";

    if (accept.includes("text/plain") || req.query.format === "prometheus") {
      res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
      return res.send(workerMetrics.toPrometheusText());
    }

    res.setHeader("Content-Type", "application/json");
    return res.json(workerMetrics.toJSON());
  });

  // On-demand cycle trigger
  app.post("/trigger", async (_req, res) => {
    console.log("[worker-server] ⚡ Manual cycle trigger requested");
    const [recResult, queueResult] = await Promise.all([
      collectAndForwardPlivoRecordings(),
      triggerQueueCleanup(),
    ]);

    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      recordings: recResult,
      queue: queueResult,
    });
  });

  return app;
}
