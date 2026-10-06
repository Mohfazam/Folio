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
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("❌ DATABASE_URL is not set in environment");
    process.exit(1);
  }

  console.log("🔌 Connecting to database...");
  const sql = neon(dbUrl);
  const db = drizzle(sql);

  const migrationsFolder = join(__dirname, "../drizzle");
  console.log(`🚀 Running migrations from ${migrationsFolder}...`);

  try {
    await migrate(db, { migrationsFolder });
    console.log("✅ Migrations applied successfully!");
  } catch (err: any) {
    console.error("❌ Migration error:", err);
    process.exit(1);
  }
}

runMigrate();
