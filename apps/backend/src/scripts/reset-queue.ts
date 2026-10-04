import "dotenv/config";
import { db } from "../config/db.js";
import { callQueue } from "@repo/db";
import { eq } from "drizzle-orm";

async function main() {
  const res = await db
    .update(callQueue)
    .set({ status: "pending", updatedAt: new Date() })
    .where(eq(callQueue.status, "in_progress"));

  console.log("Reset all in_progress queue entries back to pending!");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
