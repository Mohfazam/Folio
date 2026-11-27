import dotenv from "dotenv";
dotenv.config();
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

const rawUrl = process.env.DATABASE_URL?.trim();
if (!rawUrl) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sql = neon(rawUrl.replace(/^['"]|['"]$/g, ""));

async function main() {
  const journalPath = path.resolve("drizzle/meta/_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));

  // Drizzle by default creates schema "drizzle" and table "__drizzle_migrations"
  await sql.query(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  await sql.query(`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  console.log("Total journal entries:", journal.entries.length);

  for (const entry of journal.entries) {
    if (entry.tag === "0017_cloudy_mongoose") {
      console.log("Leaving 0017_cloudy_mongoose unapplied so db:migrate will execute it!");
      continue;
    }

    const sqlFilePath = path.resolve("drizzle", entry.tag + ".sql");
    const content = fs.readFileSync(sqlFilePath, "utf-8");
    const hash = crypto.createHash("sha256").update(content).digest("hex");

    // Check if already inserted
    const existing = await sql.query(
      `SELECT id FROM "drizzle"."__drizzle_migrations" WHERE hash = $1`,
      [hash]
    );

    if (existing.length === 0) {
      await sql.query(
        `INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
        [hash, entry.when]
      );
      console.log("Recorded baseline for:", entry.tag);
    } else {
      console.log("Already recorded:", entry.tag);
    }
  }

  console.log("Baseline established successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
