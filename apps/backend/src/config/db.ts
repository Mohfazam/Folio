import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import WebSocket from "ws";
import * as schema from "@repo/db";
import { env } from "./env.js";

neonConfig.webSocketConstructor = WebSocket;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
});

export const db = drizzle(pool, { schema });

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
