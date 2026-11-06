import { pool } from "../config/db.js";
import { cleanupExpiredPublicDemoData } from "../services/publicDemoRetention.js";

try {
  const redacted = await cleanupExpiredPublicDemoData();
  console.log(`[public-demo] Redacted ${redacted} visitor phone record(s).`);
} finally {
  await pool.end();
}
