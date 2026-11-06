import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { callQueue, calls, contacts } from "@repo/db";

/** Redact public-demo destination data after the 24-hour abuse-prevention window. */
export async function cleanupExpiredPublicDemoData(): Promise<number> {
  const clientId = process.env.PUBLIC_DEMO_CLIENT_ID?.trim();
  if (!clientId) return 0;

  const retentionCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const oldDemoContacts = await db.select({ id: contacts.id }).from(contacts)
    .where(and(
      eq(contacts.clientId, clientId),
      lt(contacts.createdAt, retentionCutoff),
      sql`${contacts.customFields}->>'_fooliooSystem' = 'public_demo'`,
    ));
  const ids = oldDemoContacts.map((row) => row.id);
  if (!ids.length) return 0;

  await db.update(calls).set({ phoneNumber: null })
    .where(and(eq(calls.clientId, clientId), inArray(calls.contactId, ids)));
  await db.update(callQueue).set({ phoneNumber: null, updatedAt: new Date() })
    .where(and(eq(callQueue.clientId, clientId), inArray(callQueue.contactId, ids)));
  await db.update(contacts).set({
    phoneNumber: "REDACTED",
    phoneNumberRaw: null,
    customFields: { _fooliooSystem: "public_demo", redactedAt: new Date().toISOString() },
    updatedAt: new Date(),
  }).where(and(eq(contacts.clientId, clientId), inArray(contacts.id, ids)));

  return ids.length;
}
