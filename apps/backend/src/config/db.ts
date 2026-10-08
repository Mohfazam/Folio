import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import WebSocket from "ws";
import * as schema from "@repo/db";
import { env } from "./env.js";

neonConfig.webSocketConstructor = WebSocket;

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
});

export const db = drizzle(pool, { schema });
