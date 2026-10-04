/**
 * Cleanup script: removes old test contacts, queue entries, and calls.
 * Run with: npx tsx src/scripts/cleanup-test-data.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql } from "drizzle-orm";
import { callQueue, contacts, calls } from "@repo/db";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("Missing DATABASE_URL"); process.exit(1); }

const db = drizzle(neon(DATABASE_URL));

async function cleanup() {
  // Delete all calls
  const deletedCalls = await db.delete(calls).returning({ id: calls.id });
  console.log(`🗑️  Deleted ${deletedCalls.length} call records`);

  // Delete all queue entries
  const deletedQueue = await db.delete(callQueue).returning({ id: callQueue.id });
  console.log(`🗑️  Deleted ${deletedQueue.length} queue entries`);

  // Delete test contacts (phone numbers starting with +9198765)
  const deletedContacts = await db
    .delete(contacts)
    .where(sql`${contacts.phoneNumber} LIKE '+9198765%'`)
    .returning({ id: contacts.id });
  console.log(`🗑️  Deleted ${deletedContacts.length} test contacts`);

  console.log("\n✅ Cleanup done. Your real contacts are still in the DB.");
}

cleanup().catch((err) => { console.error("Cleanup failed:", err); process.exit(1); });
