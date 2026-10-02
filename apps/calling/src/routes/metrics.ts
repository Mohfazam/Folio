import type { Request, Response } from "express";
import { metricsCollector } from "../monitoring/metricsCollector.js";

/**
 * GET /metrics
 *
 * Comprehensive operational and business metrics endpoint.
 * Supports:
 * - Default: JSON format (deep diagnostic info, call stats, latencies, memory, sentiment)
 * - Prometheus format: ?format=prometheus or Accept: text/plain
 */
export function metricsRoute(req: Request, res: Response) {
  const format = (req.query.format as string) || "";
  const accepts = req.headers.accept || "";

  if (format === "prometheus" || accepts.includes("text/plain")) {
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    return res.status(200).send(metricsCollector.toPrometheusFormat());
  }

  const snapshot = metricsCollector.getSnapshot();
  return res.status(200).json(snapshot);
}
