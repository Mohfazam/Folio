import "dotenv/config";
import { db } from "../config/db.js";
import { callQueue, calls } from "@repo/db";

async function main() {
  const queue = await db.select().from(callQueue);
  console.log("=== CALL QUEUE ===");
  console.table(queue.map(q => ({
    id: q.id.slice(0, 8),
    contact: q.contactName,
    phone: q.phoneNumber,
    status: q.status,
    attempts: q.attemptNumber,
    scheduledFor: q.scheduledFor,
  })));

  const callList = await db.select().from(calls);
  console.log("=== CALLS ===");
  console.table(callList.map(c => ({
    id: c.id.slice(0, 8),
    contact: c.contactName,
    phone: c.phoneNumber,
    outcome: c.outcome,
    duration: c.durationSeconds,
    status: c.sentiment,
  })));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
