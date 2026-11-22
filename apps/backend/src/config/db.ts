import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import WebSocket from "ws";
import * as schema from "@repo/db";
import { env } from "./env.js";

neonConfig.webSocketConstructor = WebSocket;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
});

// Prevent unhandled 'error' events on idle pooled WebSocket clients from crashing or poisoning state.
pool.on("error", (err: unknown) => {
  console.warn("[db/pool] Idle database client error:", err instanceof Error ? err.message : err);
});

export const db = drizzle(pool, { schema });

const TRANSIENT_DB_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "57P01",
  "57P02",
  "57P03",
  "53300",
  "53400",
]);

function extractErrorDetails(err: unknown): { code?: string; message: string } {
  if (!err || typeof err !== "object") {
    return { message: String(err ?? "") };
  }
  const record = err as Record<string, unknown>;
  const cause = record.cause && typeof record.cause === "object" ? (record.cause as Record<string, unknown>) : null;
  const code =
    typeof record.code === "string"
      ? record.code
      : typeof cause?.code === "string"
        ? cause.code
        : undefined;
  const parts = [
    typeof record.message === "string" ? record.message : "",
    typeof cause?.message === "string" ? cause.message : "",
  ].filter(Boolean);
  return { code, message: parts.join(" | ") };
}

export function isTransientDatabaseError(err: unknown): boolean {
  const { code, message } = extractErrorDetails(err);
  if (code && TRANSIENT_DB_CODES.has(code)) {
    return true;
  }
  return /ECONNRESET|ETIMEDOUT|EPIPE|Connection terminated|socket hang up|WebSocket|terminating connection|too many connections|compute.*wake|Control plane request failed/i.test(
    message,
  );
}

/**
 * Retries idempotent database reads when Neon serverless / WebSocket pool connections
 * drop transiently (e.g. idle socket termination or compute wake-up).
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  options: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 120;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (err: unknown) {
      lastError = err;
      if (attempt >= retries || !isTransientDatabaseError(err)) {
        throw err;
      }
      const delayMs = baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}

/**
 * Executes a fast ping against the Neon Postgres database to verify connectivity.
 */
export async function checkDatabaseHealth(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await pool.query("SELECT 1");
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err: unknown) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
