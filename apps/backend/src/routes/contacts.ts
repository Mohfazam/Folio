import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { contacts, uploadBatches, callQueue, clients } from "@repo/db";
import { processNextEligibleCall } from "../worker/processQueue.js";

/**
 * POST /api/contacts/bulk
 *
 * Bulk-import contacts for a client. Creates an uploadBatches row, inserts
 * every contact, marks the batch completed, and optionally auto-enqueues them
 * into the call queue immediately.
 *
 * Request body:
 *   {
 *     clientId: string,
 *     label?: string,
 *     autoEnqueue?: boolean,
 *     campaignId?: string,
 *     maxCallsPerDay?: number,
 *     scheduledFor?: string (ISO 8601),
 *     contacts: ContactRow[]
 *   }
 */
export async function bulkContactsRoute(req: Request, res: Response) {
  try {
    const {
      clientId,
      label,
      autoEnqueue,
      campaignId,
      maxCallsPerDay,
      scheduledFor,
      contacts: contactRows,
    } = req.body as {
      clientId?: string;
      label?: string;
      autoEnqueue?: boolean;
      campaignId?: string;
      maxCallsPerDay?: number;
      scheduledFor?: string;
      contacts?: Record<string, unknown>[];
    };

    if (!clientId) {
      return res.status(400).json({ ok: false, error: "clientId is required" });
    }

    if (!Array.isArray(contactRows) || contactRows.length === 0) {
      return res.status(400).json({ ok: false, error: "contacts array is required and must be non-empty" });
    }

    // Optional: update client's maxCallsPerDay setting if specified from UI dropdown
    if (typeof maxCallsPerDay === "number" && maxCallsPerDay > 0) {
      await db
        .update(clients)
        .set({ maxCallsPerDay, updatedAt: new Date() })
        .where(eq(clients.id, clientId));
    }

    // 1. Create the upload batch row
    const [batch] = await db
      .insert(uploadBatches)
      .values({
        clientId,
        filename: label ?? `bulk-upload-${new Date().toISOString()}`,
        totalRows: contactRows.length,
        status: "processing",
      })
      .returning();

    if (!batch) {
      return res.status(500).json({ ok: false, error: "Failed to create upload batch" });
    }

    // 2. Insert contacts one-by-one to track per-row failures and collect IDs for auto-enqueue
    const failedRows: { index: number; error: string }[] = [];
    const insertedContacts: { id: string; fullName: string | null; phoneNumber: string }[] = [];

    for (let i = 0; i < contactRows.length; i++) {
      const row = contactRows[i]!;
      try {
        const [newContact] = await db
          .insert(contacts)
          .values({
            clientId,
            uploadBatchId: batch.id,
            fullName: (row.fullName as string | undefined) ?? null,
            secondaryName: (row.secondaryName as string | undefined) ?? null,
            phoneNumber: row.phoneNumber as string,
            phoneNumberRaw: (row.phoneNumberRaw as string | undefined) ?? null,
            email: (row.email as string | undefined) ?? null,
            parentName: (row.parentName as string | undefined) ?? null,
            studentName: (row.studentName as string | undefined) ?? null,
            courseOrStream: (row.courseOrStream as string | undefined) ?? null,
            contextData: row.contextData ?? {},
            customFields: row.customFields,
            status: autoEnqueue ? "queued" : "pending",
          })
          .returning({ id: contacts.id, fullName: contacts.fullName, phoneNumber: contacts.phoneNumber });

        if (newContact) {
          insertedContacts.push(newContact);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        failedRows.push({ index: i, error: message });
      }
    }

    // 3. Update batch with final counts
    await db
      .update(uploadBatches)
      .set({
        status: failedRows.length === contactRows.length ? "failed" : "completed",
        validRows: insertedContacts.length,
        invalidRows: failedRows.length,
        totalRows: contactRows.length,
      })
      .where(eq(uploadBatches.id, batch.id));

    // 4. If autoEnqueue is enabled, add all inserted contacts to call_queue and start worker
    let enqueuedCount = 0;
    if (autoEnqueue && insertedContacts.length > 0) {
      const scheduleDate = scheduledFor ? new Date(scheduledFor) : new Date();

      for (const c of insertedContacts) {
        try {
          await db.insert(callQueue).values({
            contactId: c.id,
            clientId,
            campaignId: campaignId ?? null,
            contactName: c.fullName,
            phoneNumber: c.phoneNumber,
            scheduledFor: scheduleDate,
            attemptNumber: 1,
            status: "pending",
            maxAttempts: 2,
            priority: 0,
          });
          enqueuedCount++;
        } catch (enqueueErr) {
          console.error("[contacts/bulk] Failed to auto-enqueue contact:", c.id, enqueueErr);
        }
      }

      // Automatically trigger the queue worker to begin dialing
      if (enqueuedCount > 0) {
        void processNextEligibleCall().catch((err) => {
          console.error("[contacts/bulk] Auto-enqueue worker trigger error:", err);
        });
      }
    }

    return res.status(201).json({
      ok: true,
      batchId: batch.id,
      totalReceived: contactRows.length,
      inserted: insertedContacts.length,
      autoEnqueued: autoEnqueue ? enqueuedCount : undefined,
      failed: failedRows.length,
      failedRows: failedRows.length > 0 ? failedRows : undefined,
    });
  } catch (err: unknown) {
    console.error("[contacts/bulk] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

