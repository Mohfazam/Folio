import type { Request, Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { followUps, contacts, calls } from "@repo/db";

const VALID_STATUSES = ["open", "done", "not_needed"] as const;
type FollowUpStatus = (typeof VALID_STATUSES)[number];

/**
 * GET /api/follow-ups
 *
 * Lists follow-ups, optionally filtered by clientId, status, or assignedTo.
 * Joins with contacts and calls tables for enriched context.
 */
export async function getFollowUpsRoute(req: Request, res: Response) {
  try {
    const { clientId, status, assignedTo, limit, offset } = req.query as {
      clientId?: string;
      status?: string;
      assignedTo?: string;
      limit?: string;
      offset?: string;
    };

    const take = Math.min(Math.max(parseInt(limit || "50", 10) || 50, 1), 100);
    const skip = Math.max(parseInt(offset || "0", 10) || 0, 0);

    const conditions = [];

    if (clientId) {
      conditions.push(eq(followUps.clientId, clientId));
    }

    if (status && VALID_STATUSES.includes(status as FollowUpStatus)) {
      conditions.push(eq(followUps.status, status as FollowUpStatus));
    }

    if (assignedTo) {
      conditions.push(eq(followUps.assignedTo, assignedTo));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch items with enriched contact and call context
    const items = await db
      .select({
        id: followUps.id,
        callId: followUps.callId,
        contactId: followUps.contactId,
        clientId: followUps.clientId,
        requestedCallbackTime: followUps.requestedCallbackTime,
        assignedTo: followUps.assignedTo,
        status: followUps.status,
        notes: followUps.notes,
        createdAt: followUps.createdAt,
        updatedAt: followUps.updatedAt,
        contact: {
          fullName: contacts.fullName,
          phoneNumber: contacts.phoneNumber,
          email: contacts.email,
          courseOrStream: contacts.courseOrStream,
        },
        call: {
          startedAt: calls.startedAt,
          outcome: calls.outcome,
          sentiment: calls.sentiment,
          interestLevel: calls.interestLevel,
          durationSeconds: calls.durationSeconds,
        },
      })
      .from(followUps)
      .leftJoin(contacts, eq(followUps.contactId, contacts.id))
      .leftJoin(calls, eq(followUps.callId, calls.id))
      .where(whereClause)
      .orderBy(desc(followUps.createdAt))
      .limit(take)
      .offset(skip);

    // Total count for pagination
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
 * PATCH /api/follow-ups/:id
 *
 * Updates a follow-up record (e.g. status to 'done', updated notes, or reassignment).
 */
export async function updateFollowUpRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Follow-up ID parameter is required" });
    }

    const { status, notes, assignedTo, requestedCallbackTime } = req.body as {
      status?: string;
      notes?: string;
      assignedTo?: string | null;
      requestedCallbackTime?: string | null;
    };

    if (status && !VALID_STATUSES.includes(status as FollowUpStatus)) {
      return res.status(400).json({
        ok: false,
        error: `Invalid status '${status}'. Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    const updateData: Partial<typeof followUps.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (status) {
      updateData.status = status as FollowUpStatus;
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    if (assignedTo !== undefined) {
      updateData.assignedTo = assignedTo;
    }

    if (requestedCallbackTime !== undefined) {
      updateData.requestedCallbackTime = requestedCallbackTime
        ? new Date(requestedCallbackTime)
        : null;
    }

    const [updated] = await db
      .update(followUps)
      .set(updateData)
      .where(eq(followUps.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ ok: false, error: `Follow-up ${id} not found` });
    }

    return res.json({
      ok: true,
      followUp: updated,
    });
  } catch (err: unknown) {
    console.error("[follow-ups/patch] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
