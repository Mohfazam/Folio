import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { contacts, callQueue } from "@repo/db";

/**
 * POST /api/queue/enqueue
 *
 * Creates call_queue entries for contacts. Accepts either an uploadBatchId
 * (enqueue all contacts in that batch) or an explicit contactIds array.
 *
 * Request body:
 *   {
 *     clientId: string,
 *     uploadBatchId?: string,
 *     contactIds?: string[],
 *     campaignId?: string,
 *     scheduledFor?: string (ISO 8601),
 *     maxAttempts?: number
 *   }
 */
export async function enqueueRoute(req: Request, res: Response) {
  try {
    const {
      clientId,
      uploadBatchId,
      contactIds,
      campaignId,
      scheduledFor,
      maxAttempts,
    } = req.body as {
      clientId?: string;
      uploadBatchId?: string;
      contactIds?: string[];
      campaignId?: string;
      scheduledFor?: string;
      maxAttempts?: number;
    };

    if (!clientId) {
      return res.status(400).json({ ok: false, error: "clientId is required" });
    }

    if (!uploadBatchId && (!Array.isArray(contactIds) || contactIds.length === 0)) {
      return res.status(400).json({
        ok: false,
        error: "Either uploadBatchId or a non-empty contactIds array is required",
      });
    }

    // Resolve contacts to enqueue
    let targetContactIds: string[];

    if (uploadBatchId) {
      // Fetch all contact IDs belonging to this upload batch
      const batchContacts = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(eq(contacts.uploadBatchId, uploadBatchId));

      if (batchContacts.length === 0) {
        return res.status(404).json({
          ok: false,
          error: `No contacts found for uploadBatchId: ${uploadBatchId}`,
        });
      }

      targetContactIds = batchContacts.map((c) => c.id);
    } else {
      targetContactIds = contactIds!;
    }

    const scheduleDate = scheduledFor ? new Date(scheduledFor) : new Date();
    const maxAtt = maxAttempts ?? 2;

    // Insert queue entries
    const failedEntries: { contactId: string; error: string }[] = [];
    let enqueuedCount = 0;

    for (const cId of targetContactIds) {
      try {
        await db.insert(callQueue).values({
          contactId: cId,
          clientId,
          campaignId: campaignId ?? null,
          scheduledFor: scheduleDate,
          attemptNumber: 1,
          status: "pending",
          maxAttempts: maxAtt,
          priority: 0,
        });
        enqueuedCount++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        failedEntries.push({ contactId: cId, error: message });
      }
    }

    return res.status(201).json({
      ok: true,
      enqueued: enqueuedCount,
      failed: failedEntries.length,
      failedEntries: failedEntries.length > 0 ? failedEntries : undefined,
    });
  } catch (err: unknown) {
    console.error("[queue/enqueue] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
