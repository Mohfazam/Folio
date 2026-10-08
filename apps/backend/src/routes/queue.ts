import type { Request, Response } from "express";
import { eq, and, desc, sql, asc, inArray } from "drizzle-orm";
import { db } from "../config/db.js";
import { contacts, callQueue, campaigns } from "@repo/db";
import { processNextEligibleCall } from "../worker/processQueue.js";

const VALID_QUEUE_STATUSES = ["pending", "in_progress", "completed", "failed", "exhausted"] as const;
type QueueStatus = (typeof VALID_QUEUE_STATUSES)[number];

/**
 * GET /api/queue
 *
 * List queue items with optional filters (clientId, campaignId, status) and pagination.
 */
export async function getQueueRoute(req: Request, res: Response) {
  try {
    const { campaignId, status, limit, offset } = req.query as {
      campaignId?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };

    const take = Math.min(Math.max(parseInt(limit || "50", 10) || 50, 1), 100);
    const skip = Math.max(parseInt(offset || "0", 10) || 0, 0);

    const conditions = [eq(callQueue.clientId, req.clientId!)];

    if (campaignId) {
      conditions.push(eq(callQueue.campaignId, campaignId));
    }

    if (status && VALID_QUEUE_STATUSES.includes(status as QueueStatus)) {
      conditions.push(eq(callQueue.status, status as QueueStatus));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select({
        id: callQueue.id,
        contactId: callQueue.contactId,
        clientId: callQueue.clientId,
        campaignId: callQueue.campaignId,
        contactName: callQueue.contactName,
        phoneNumber: callQueue.phoneNumber,
        scheduledFor: callQueue.scheduledFor,
        attemptNumber: callQueue.attemptNumber,
        priority: callQueue.priority,
        status: callQueue.status,
        maxAttempts: callQueue.maxAttempts,
        createdAt: callQueue.createdAt,
        updatedAt: callQueue.updatedAt,
        campaignName: campaigns.name,
        contact: {
          fullName: contacts.fullName,
          email: contacts.email,
          courseOrStream: contacts.courseOrStream,
        },
      })
      .from(callQueue)
      .leftJoin(contacts, eq(callQueue.contactId, contacts.id))
      .leftJoin(campaigns, eq(callQueue.campaignId, campaigns.id))
      .where(whereClause)
      .orderBy(asc(callQueue.scheduledFor), desc(callQueue.priority))
      .limit(take)
      .offset(skip);

    const [countResult] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(callQueue)
      .where(whereClause);

    const total = countResult?.total ?? items.length;

    return res.json({
      ok: true,
      queue: items,
      total,
      limit: take,
      offset: skip,
    });
  } catch (err: unknown) {
    console.error("[queue/get] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * POST /api/queue/enqueue
 *
 * Creates call_queue entries for contacts. Accepts either an uploadBatchId
 * (enqueue all contacts in that batch) or an explicit contactIds array.
 */
export async function enqueueRoute(req: Request, res: Response) {
  try {
    const {
      uploadBatchId,
      contactIds,
      campaignId,
      scheduledFor,
      maxAttempts,
      priority,
    } = req.body as {
      uploadBatchId?: string;
      contactIds?: string[];
      campaignId?: string;
      scheduledFor?: string;
      maxAttempts?: number;
      priority?: number;
    };

    const clientId = req.clientId!;
    const isUuid = (value: unknown): value is string =>
      typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

    if (uploadBatchId !== undefined && !isUuid(uploadBatchId)) {
      return res.status(400).json({ ok: false, error: "uploadBatchId must be a valid ID" });
    }
    if (!uploadBatchId && (!Array.isArray(contactIds) || contactIds.length === 0)) {
      return res.status(400).json({
        ok: false,
        error: "Either uploadBatchId or a non-empty contactIds array is required",
      });
    }
    if (uploadBatchId && contactIds) {
      return res.status(400).json({ ok: false, error: "Provide uploadBatchId or contactIds, not both" });
    }
    if (contactIds !== undefined && !Array.isArray(contactIds)) {
      return res.status(400).json({ ok: false, error: "contactIds must be an array" });
    }
    if (!campaignId) {
      return res.status(400).json({ ok: false, error: "campaignId is required" });
    }
    if (!isUuid(campaignId)) {
      return res.status(400).json({ ok: false, error: "campaignId must be a valid ID" });
    }
    if (contactIds && contactIds.length > 500) {
      return res.status(413).json({ ok: false, error: "A queue request may include at most 500 contacts" });
    }
    if (contactIds && contactIds.some((contactId) => !isUuid(contactId))) {
      return res.status(400).json({ ok: false, error: "contactIds must contain valid contact IDs" });
    }
    if (scheduledFor !== undefined && typeof scheduledFor !== "string") {
      return res.status(400).json({ ok: false, error: "scheduledFor must be a date string" });
    }

    const [campaign] = await db
      .select({ id: campaigns.id, status: campaigns.status })
      .from(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.clientId, clientId)))
      .limit(1);
    if (!campaign || campaign.status !== "active") {
      return res.status(400).json({ ok: false, error: "Only an active workspace campaign can be queued" });
    }

    // Resolve contacts to enqueue
    let targetContactIds: string[];

    if (uploadBatchId) {
      const batchContacts = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(
          eq(contacts.uploadBatchId, uploadBatchId),
          eq(contacts.clientId, clientId),
          eq(contacts.optOut, false),
        ));

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
    if (Number.isNaN(scheduleDate.getTime())) {
      return res.status(400).json({ ok: false, error: "scheduledFor must be a valid date" });
    }
    const maxAtt = maxAttempts ?? 2;
    const prio = priority ?? 0;
    if (!Number.isInteger(maxAtt) || maxAtt < 1 || maxAtt > 5) {
      return res.status(400).json({ ok: false, error: "maxAttempts must be an integer between 1 and 5" });
    }
    if (!Number.isInteger(prio) || prio < -100 || prio > 100) {
      return res.status(400).json({ ok: false, error: "priority must be an integer between -100 and 100" });
    }

    const failedEntries: { contactId: string; error: string }[] = [];
    let enqueuedCount = 0;

    for (const cId of targetContactIds) {
      try {
        const result = await db.transaction(async (tx) => {
          const [contact] = await tx
            .select({
              id: contacts.id,
              fullName: contacts.fullName,
              phoneNumber: contacts.phoneNumber,
              optOut: contacts.optOut,
              status: contacts.status,
            })
            .from(contacts)
            .where(and(eq(contacts.id, cId), eq(contacts.clientId, clientId)))
            .for("update")
            .limit(1);

          if (!contact) return "Contact not found in this workspace";
          if (contact.optOut || contact.status === "do_not_call" || contact.status === "invalid") {
            return "Contact is opted out or cannot be called";
          }

          const [existing] = await tx
            .select({ id: callQueue.id })
            .from(callQueue)
            .where(and(
              eq(callQueue.contactId, cId),
              eq(callQueue.clientId, clientId),
              inArray(callQueue.status, ["pending", "in_progress"]),
            ))
            .limit(1);
          if (existing) return "Contact already has an active queue entry";

          await tx.insert(callQueue).values({
            contactId: cId,
            clientId,
            campaignId,
            contactName: contact.fullName,
            phoneNumber: contact.phoneNumber,
            scheduledFor: scheduleDate,
            attemptNumber: 1,
            status: "pending",
            maxAttempts: maxAtt,
            priority: prio,
          });

          await tx
            .update(contacts)
            .set({ status: "queued", updatedAt: new Date() })
            .where(and(eq(contacts.id, cId), eq(contacts.clientId, clientId)));

          return null;
        });

        if (result) {
          failedEntries.push({ contactId: cId, error: result });
        } else {
          enqueuedCount++;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        failedEntries.push({ contactId: cId, error: message });
      }
    }

    // Automatically trigger queue processing if we enqueued new entries
    if (enqueuedCount > 0) {
      void processNextEligibleCall().catch((err) => {
        console.error("[queue/enqueue] Background worker trigger error:", err);
      });
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

/**
 * PATCH /api/queue/:id
 *
 * Update queue entry details (scheduledFor, priority, maxAttempts, status).
 */
export async function updateQueueRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Queue ID is required" });
    }

    const { scheduledFor, priority, maxAttempts } = req.body as {
      scheduledFor?: string;
      priority?: number;
      maxAttempts?: number;
    };

    const updateData: Partial<typeof callQueue.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (scheduledFor) {
      const parsed = new Date(scheduledFor);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ ok: false, error: "scheduledFor must be a valid date" });
      }
      updateData.scheduledFor = parsed;
    }

    if (typeof priority === "number") {
      updateData.priority = priority;
    }

    if (typeof maxAttempts === "number" && maxAttempts > 0) {
      updateData.maxAttempts = maxAttempts;
    }
    if (maxAttempts !== undefined && (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5)) {
      return res.status(400).json({ ok: false, error: "maxAttempts must be an integer between 1 and 5" });
    }
    if (priority !== undefined && (!Number.isInteger(priority) || priority < -100 || priority > 100)) {
      return res.status(400).json({ ok: false, error: "priority must be an integer between -100 and 100" });
    }

    const [updated] = await db
      .update(callQueue)
      .set(updateData)
      .where(and(eq(callQueue.id, id), eq(callQueue.clientId, req.clientId!), eq(callQueue.status, "pending")))
      .returning();

    if (!updated) {
      return res.status(404).json({ ok: false, error: `Queue entry ${id} not found` });
    }

    return res.json({ ok: true, queueEntry: updated });
  } catch (err: unknown) {
    console.error("[queue/patch] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * DELETE /api/queue/:id
 *
 * Delete / cancel a queue entry.
 */
export async function deleteQueueRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Queue ID is required" });
    }

    const [deleted] = await db
      .delete(callQueue)
      .where(and(eq(callQueue.id, id), eq(callQueue.clientId, req.clientId!), eq(callQueue.status, "pending")))
      .returning();

    if (!deleted) {
      return res.status(404).json({ ok: false, error: `Queue entry ${id} not found` });
    }

    return res.json({ ok: true, message: `Queue entry ${id} cancelled and removed` });
  } catch (err: unknown) {
    console.error("[queue/delete] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
