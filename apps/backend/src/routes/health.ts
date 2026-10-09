import type { Request, Response } from "express";
import { checkDatabaseHealth } from "../config/db.js";
import { isFirebaseConfigured } from "../config/firebase.js";

let isShuttingDownState = false;

export function setShuttingDown(shuttingDown: boolean): void {
  isShuttingDownState = shuttingDown;
}

export function isShuttingDown(): boolean {
  return isShuttingDownState;
}

/**
 * Liveness probe: returns 200 OK immediately if the Express process is running.
 * Used by container orchestrators (e.g. Railway, Kubernetes) to verify container is alive.
 */
export function getLivenessRoute(_req: Request, res: Response) {
  res.status(200).json({
    status: "healthy",
    service: "folio-backend",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Deep Readiness probe: checks dependencies before declaring readiness to accept traffic.
 * Checks Neon Postgres database connectivity and Firebase Admin state.
 * Returns 503 if the service is draining or if critical dependencies are unreachable.
 */
export async function getReadinessRoute(_req: Request, res: Response) {
  if (isShuttingDownState) {
    return res.status(503).json({
      status: "shutting_down",
      error: "Service is draining connections and shutting down",
      timestamp: new Date().toISOString(),
    });
  }

  const dbHealth = await checkDatabaseHealth();
  const firebaseReady = isFirebaseConfigured();

  const isHealthy = dbHealth.ok;
  const statusCode = isHealthy ? 200 : 503;

  return res.status(statusCode).json({
    status: isHealthy ? "ready" : "unhealthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks: {
      database: {
        status: dbHealth.ok ? "connected" : "disconnected",
        latencyMs: dbHealth.latencyMs,
        ...(dbHealth.error ? { error: dbHealth.error } : {}),
      },
      firebase: {
        status: firebaseReady ? "initialized" : "not_configured",
      },
    },
  });
}
