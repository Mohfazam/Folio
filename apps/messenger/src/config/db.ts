import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@repo/db";
import { env } from "./env.js";

const sql = neon(env.databaseUrl);
export const db = drizzle(sql, { schema });
