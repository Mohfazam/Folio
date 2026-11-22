import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });
dotenv.config(); // fallback to process.cwd() .env

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

async function runMigrate() {
  const rawUrl = process.env.DATABASE_URL?.trim();
  if (!rawUrl) {
    console.error("❌ DATABASE_URL is not set in environment");
    process.exit(1);
  }

  // Strip wrapping quotes if present
  const dbUrl = rawUrl.replace(/^['"]|['"]$/g, "");

  console.log("🔌 Connecting to database...");
  const sql = neon(dbUrl);
  const db = drizzle(sql);

  const migrationsFolder = join(__dirname, "../drizzle");
  console.log(`🚀 Running migrations from ${migrationsFolder}...`);

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await migrate(db, { migrationsFolder });
      console.log("✅ Migrations applied successfully!");
      return;
    } catch (err: any) {
      const isConnectionError =
        err?.message?.includes("fetch failed") ||
        err?.cause?.message?.includes("fetch failed") ||
        err?.code === "ECONNRESET" ||
        err?.code === "ETIMEDOUT";

      if (isConnectionError && attempt < MAX_RETRIES) {
        const delayMs = attempt * 2500;
        console.warn(`⏳ Neon compute is waking up from sleep (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delayMs / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      console.error("❌ Migration error:", err);
      process.exit(1);
    }
  }
}

runMigrate();
