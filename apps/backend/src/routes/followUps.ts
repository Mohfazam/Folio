import type { Request, Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { followUps, contacts, calls, users } from "@repo/db";

const VALID_STATUSES = ["open", "done", "not_needed"] as const;
type FollowUpStatus = (typeof VALID_STATUSES)[number];

const VALID_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

/**
 * GET /api/follow-ups
 *
 * Lists follow-ups with filtering by clientId, status, assignedTo, priority, or type.
 */
export async function getFollowUpsRoute(req: Request, res: Response) {
  try {
    const { status, assignedTo, priority, type, limit, offset } = req.query as {
      status?: string;
      assignedTo?: string;
      priority?: string;
      type?: string;
      limit?: string;
      offset?: string;
    };

    const take = Math.min(Math.max(parseInt(limit || "50", 10) || 50, 1), 100);
    const skip = Math.max(parseInt(offset || "0", 10) || 0, 0);

    const conditions = [eq(followUps.clientId, req.clientId!)];

    if (status && VALID_STATUSES.includes(status as FollowUpStatus)) {
      conditions.push(eq(followUps.status, status as FollowUpStatus));
    }

    if (assignedTo) {
      conditions.push(eq(followUps.assignedTo, assignedTo));
    }

    if (priority) {
      conditions.push(eq(followUps.priority, priority));
    }

    if (type) {
      conditions.push(eq(followUps.type, type));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await db
      .select({
        id: followUps.id,
        callId: followUps.callId,
        contactId: followUps.contactId,
        clientId: followUps.clientId,
        type: followUps.type,
        priority: followUps.priority,
        dueDate: followUps.dueDate,
        requestedCallbackTime: followUps.requestedCallbackTime,
        assignedTo: followUps.assignedTo,
        status: followUps.status,
        notes: followUps.notes,
        createdAt: followUps.createdAt,
        updatedAt: followUps.updatedAt,
        contact: {
          id: contacts.id,
          fullName: contacts.fullName,
          phoneNumber: contacts.phoneNumber,
          email: contacts.email,
          companyName: contacts.companyName,
          jobTitle: contacts.jobTitle,
          courseOrStream: contacts.courseOrStream,
        },
        call: {
          id: calls.id,
          startedAt: calls.startedAt,
          outcome: calls.outcome,
          sentiment: calls.sentiment,
          interestLevel: calls.interestLevel,
          durationSeconds: calls.durationSeconds,
          summary: calls.summary,
        },
      })
      .from(followUps)
      .leftJoin(contacts, and(eq(followUps.contactId, contacts.id), eq(followUps.clientId, contacts.clientId)))
      .leftJoin(calls, and(eq(followUps.callId, calls.id), eq(followUps.clientId, calls.clientId)))
      .where(whereClause)
      .orderBy(desc(followUps.createdAt))
      .limit(take)
      .offset(skip);

    const [countResult] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(followUps)
      .where(whereClause);

    const total = countResult?.total ?? items.length;

    return res.json({
      ok: true,
      followUps: items,
      total,
      limit: take,
      offset: skip,
    });
  } catch (err: unknown) {
    console.error("[follow-ups/get] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * POST /api/follow-ups
 *
 * Manually create a follow-up action.
 */
export async function createFollowUpRoute(req: Request, res: Response) {
  try {
    const {
      contactId,
      callId,
      type = "call_back",
      priority = "medium",
      dueDate,
      requestedCallbackTime,
      assignedTo,
      notes,
    } = req.body as {
      contactId?: string;
      callId?: string;
      type?: string;
      priority?: string;
      dueDate?: string;
      requestedCallbackTime?: string;
      assignedTo?: string;
      notes?: string;
    };

    const clientId = req.clientId!;
    if (!contactId) {
      return res.status(400).json({ ok: false, error: "contactId is required" });
    }

    if (!VALID_PRIORITIES.includes(priority as (typeof VALID_PRIORITIES)[number])) {
      return res.status(400).json({ ok: false, error: "Invalid follow-up priority" });
    }

    const parsedDueDate = dueDate ? new Date(dueDate) : null;
    const parsedCallbackTime = requestedCallbackTime ? new Date(requestedCallbackTime) : null;
    if (
      (parsedDueDate && Number.isNaN(parsedDueDate.getTime())) ||
      (parsedCallbackTime && Number.isNaN(parsedCallbackTime.getTime()))
    ) {
      return res.status(400).json({ ok: false, error: "Follow-up dates must be valid timestamps" });
    }

    const [contact] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.id, contactId), eq(contacts.clientId, clientId)))
      .limit(1);
    if (!contact) {
      return res.status(404).json({ ok: false, error: "Contact not found in this workspace" });
    }

    if (callId) {
      const [call] = await db
        .select({ id: calls.id })
        .from(calls)
        .where(and(eq(calls.id, callId), eq(calls.clientId, clientId)))
        .limit(1);
      if (!call) {
        return res.status(404).json({ ok: false, error: "Call not found in this workspace" });
      }
    }

    if (assignedTo) {
      const [assignee] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, assignedTo), eq(users.clientId, clientId)))
        .limit(1);
      if (!assignee) {
        return res.status(400).json({ ok: false, error: "assignedTo must be a user in this workspace" });
      }
    }

    const [newFollowUp] = await db
      .insert(followUps)
      .values({
        clientId,
        contactId,
        callId: callId ?? null,
        type,
        priority,
        dueDate: parsedDueDate,
        requestedCallbackTime: parsedCallbackTime,
        assignedTo: assignedTo ?? null,
        status: "open",
        notes: notes ?? null,
      })
      .returning();

    return res.status(201).json({ ok: true, followUp: newFollowUp });
  } catch (err: unknown) {
    console.error("[follow-ups/create] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * PATCH /api/follow-ups/:id
 *
 * Updates a follow-up record.
 */
export async function updateFollowUpRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Follow-up ID is required" });
    }

    const { status, notes, assignedTo, requestedCallbackTime, dueDate, priority, type } = req.body as {
      status?: string;
      notes?: string;
      assignedTo?: string | null;
      requestedCallbackTime?: string | null;
      dueDate?: string | null;
      priority?: string;
      type?: string;
    };

    if (status && !VALID_STATUSES.includes(status as FollowUpStatus)) {
      return res.status(400).json({
        ok: false,
        error: `Invalid status '${status}'. Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }
    if (priority && !VALID_PRIORITIES.includes(priority as (typeof VALID_PRIORITIES)[number])) {
      return res.status(400).json({ ok: false, error: "Invalid follow-up priority" });
    }
    if (requestedCallbackTime && Number.isNaN(new Date(requestedCallbackTime).getTime())) {
      return res.status(400).json({ ok: false, error: "requestedCallbackTime must be a valid timestamp" });
    }
    if (dueDate && Number.isNaN(new Date(dueDate).getTime())) {
      return res.status(400).json({ ok: false, error: "dueDate must be a valid timestamp" });
    }
    if (assignedTo) {
      const [assignee] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.id, assignedTo), eq(users.clientId, req.clientId!)))
        .limit(1);
      if (!assignee) {
        return res.status(400).json({ ok: false, error: "assignedTo must be a user in this workspace" });
      }
    }

    const updateData: Partial<typeof followUps.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (status) updateData.status = status as FollowUpStatus;
    if (notes !== undefined) updateData.notes = notes;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (priority) updateData.priority = priority;
    if (type) updateData.type = type;

    if (requestedCallbackTime !== undefined) {
      updateData.requestedCallbackTime = requestedCallbackTime
        ? new Date(requestedCallbackTime)
        : null;
    }

    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    }

    const [updated] = await db
      .update(followUps)
      .set(updateData)
      .where(and(eq(followUps.id, id), eq(followUps.clientId, req.clientId!)))
      .returning();

    if (!updated) {
      return res.status(404).json({ ok: false, error: `Follow-up ${id} not found` });
    }

    return res.json({ ok: true, followUp: updated });
  } catch (err: unknown) {
    console.error("[follow-ups/patch] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * DELETE /api/follow-ups/:id
 *
 * Deletes a follow-up record.
 */
export async function deleteFollowUpRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Follow-up ID is required" });
    }

    const [deleted] = await db
      .delete(followUps)
      .where(and(eq(followUps.id, id), eq(followUps.clientId, req.clientId!)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ ok: false, error: `Follow-up ${id} not found` });
    }

    return res.json({ ok: true, message: `Follow-up ${id} deleted` });
  } catch (err: unknown) {
    console.error("[follow-ups/delete] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
