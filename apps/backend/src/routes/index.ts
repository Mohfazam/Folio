import type { Express } from "express";
import { bulkContactsRoute } from "./contacts.js";
import { enqueueRoute } from "./queue.js";
import { processQueueRoute } from "./process.js";
import { callCompleteRoute } from "./calls.js";

export function registerRoutes(app: Express) {
  // Bulk contact ingestion
  app.post("/api/contacts/bulk", bulkContactsRoute);

  // Enqueue contacts for calling
  app.post("/api/queue/enqueue", enqueueRoute);

  // Manual / cron trigger for the queue worker
  app.post("/api/queue/process", processQueueRoute);

  // Call completion webhook (receives results from /apps/calling)
  app.post("/api/calls/complete", callCompleteRoute);

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      status: "healthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });
}
