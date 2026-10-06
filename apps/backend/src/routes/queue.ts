import type { Request, Response } from "express";
import { eq, and, desc, sql, asc } from "drizzle-orm";
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
    const { clientId, campaignId, status, limit, offset } = req.query as {
      clientId?: string;
      campaignId?: string;
      status?: string;
      limit?: string;
      offset?: string;
    };

    const take = Math.min(Math.max(parseInt(limit || "50", 10) || 50, 1), 100);
    const skip = Math.max(parseInt(offset || "0", 10) || 0, 0);

    const conditions = [];

    if (clientId) {
      conditions.push(eq(callQueue.clientId, clientId));
    }

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
      clientId,
      uploadBatchId,
      contactIds,
      campaignId,
      scheduledFor,
      maxAttempts,
      priority,
    } = req.body as {
      clientId?: string;
      uploadBatchId?: string;
      contactIds?: string[];
      campaignId?: string;
      scheduledFor?: string;
      maxAttempts?: number;
      priority?: number;
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
    const prio = priority ?? 0;

    const failedEntries: { contactId: string; error: string }[] = [];
    let enqueuedCount = 0;

    for (const cId of targetContactIds) {
      try {
        const [contact] = await db
          .select({ fullName: contacts.fullName, phoneNumber: contacts.phoneNumber })
          .from(contacts)
          .where(eq(contacts.id, cId))
          .limit(1);

        await db.insert(callQueue).values({
          contactId: cId,
          clientId,
          campaignId: campaignId ?? null,
          contactName: contact?.fullName ?? null,
          phoneNumber: contact?.phoneNumber ?? null,
          scheduledFor: scheduleDate,
          attemptNumber: 1,
          status: "pending",
          maxAttempts: maxAtt,
          priority: prio,
        });

        await db
          .update(contacts)
          .set({ status: "queued", updatedAt: new Date() })
          .where(eq(contacts.id, cId));

        enqueuedCount++;
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

    const { scheduledFor, priority, maxAttempts, status } = req.body as {
      scheduledFor?: string;
      priority?: number;
      maxAttempts?: number;
      status?: string;
    };

    if (status && !VALID_QUEUE_STATUSES.includes(status as QueueStatus)) {
      return res.status(400).json({
        ok: false,
        error: `Invalid status '${status}'. Must be one of: ${VALID_QUEUE_STATUSES.join(", ")}`,
      });
    }

    const updateData: Partial<typeof callQueue.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (scheduledFor) {
      const parsed = new Date(scheduledFor);
      if (!isNaN(parsed.getTime())) updateData.scheduledFor = parsed;
    }

    if (typeof priority === "number") {
      updateData.priority = priority;
    }

    if (typeof maxAttempts === "number" && maxAttempts > 0) {
      updateData.maxAttempts = maxAttempts;
    }

    if (status) {
      updateData.status = status as QueueStatus;
    }

    const [updated] = await db
      .update(callQueue)
      .set(updateData)
      .where(eq(callQueue.id, id))
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
      .where(eq(callQueue.id, id))
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
