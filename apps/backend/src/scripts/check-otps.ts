import { db } from "../config/db.js";
import { emailVerificationOtps } from "@repo/db";
import { desc } from "drizzle-orm";

async function main() {
  const rows = await db
    .select({
      id: emailVerificationOtps.id,
      email: emailVerificationOtps.email,
      otpHash: emailVerificationOtps.otpHash,
      purpose: emailVerificationOtps.purpose,
      expiresAt: emailVerificationOtps.expiresAt,
      consumedAt: emailVerificationOtps.consumedAt,
      attempts: emailVerificationOtps.attempts,
      createdAt: emailVerificationOtps.createdAt,
    })
    .from(emailVerificationOtps)
    .orderBy(desc(emailVerificationOtps.createdAt))
    .limit(10);

  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
