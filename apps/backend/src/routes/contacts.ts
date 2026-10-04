import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { contacts, uploadBatches } from "@repo/db";

/**
 * POST /api/contacts/bulk
 *
 * Bulk-import contacts for a client. Creates an uploadBatches row, inserts
 * every contact, then marks the batch completed.
 *
 * Request body:
 *   { clientId: string, label?: string, contacts: ContactRow[] }
 *
 * Each ContactRow may include any column from the `contacts` table except
 * `id`, `clientId`, `uploadBatchId`, `createdAt`, `updatedAt`.
 */
export async function bulkContactsRoute(req: Request, res: Response) {
  try {
    const { clientId, label, contacts: contactRows } = req.body as {
      clientId?: string;
      label?: string;
      contacts?: Record<string, unknown>[];
    };

    if (!clientId) {
      return res.status(400).json({ ok: false, error: "clientId is required" });
    }

    if (!Array.isArray(contactRows) || contactRows.length === 0) {
      return res.status(400).json({ ok: false, error: "contacts array is required and must be non-empty" });
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

    // 2. Insert contacts one-by-one to track per-row failures
    const failedRows: { index: number; error: string }[] = [];
    let insertedCount = 0;

    for (let i = 0; i < contactRows.length; i++) {
      const row = contactRows[i]!;
      try {
        await db.insert(contacts).values({
          clientId,
          uploadBatchId: batch.id,
          fullName: row.fullName as string | undefined,
          secondaryName: row.secondaryName as string | undefined,
          phoneNumber: row.phoneNumber as string,
          phoneNumberRaw: row.phoneNumberRaw as string | undefined,
          email: row.email as string | undefined,
          parentName: row.parentName as string | undefined,
          studentName: row.studentName as string | undefined,
          courseOrStream: row.courseOrStream as string | undefined,
          contextData: row.contextData ?? {},
          customFields: row.customFields,
          status: "pending",
        });
        insertedCount++;
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
        validRows: insertedCount,
        invalidRows: failedRows.length,
        totalRows: contactRows.length,
      })
      .where(eq(uploadBatches.id, batch.id));

    return res.status(201).json({
      ok: true,
      batchId: batch.id,
      totalReceived: contactRows.length,
      inserted: insertedCount,
      failed: failedRows.length,
      failedRows: failedRows.length > 0 ? failedRows : undefined,
    });
  } catch (err: unknown) {
    console.error("[contacts/bulk] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
