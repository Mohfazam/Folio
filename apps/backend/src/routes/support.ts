import type { Request, Response } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { supportTickets } from "@repo/db";
import { sendSupportTicketEmail, sendSupportReplyEmail } from "../services/email.js";

const VALID_TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
type TicketStatus = (typeof VALID_TICKET_STATUSES)[number];

/**
 * POST /api/support/ticket
 *
 * Stores a customer support ticket or complaint in `support_tickets` and
 * attempts best-effort email notification without failing DB persistence if SMTP is unavailable.
 */
export async function submitSupportTicketRoute(req: Request, res: Response) {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 100) : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const rawCategory = typeof req.body?.category === "string" ? req.body.category.trim().slice(0, 40) : "";
    const rawSubject = typeof req.body?.subject === "string" ? req.body.subject.trim().slice(0, 160) : "";
    const subject = (rawCategory ? `[${rawCategory}] ${rawSubject}` : rawSubject).slice(0, 200);
    const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 5000) : "";
    const contactPhone = typeof req.body?.contactPhone === "string" ? req.body.contactPhone.trim().slice(0, 40) : null;

    if (!name) {
      return res.status(400).json({ ok: false, error: "Your name is required" });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "A valid email address is required" });
    }
    if (!rawSubject) {
      return res.status(400).json({ ok: false, error: "Subject is required" });
    }
    if (!message || message.length < 5) {
      return res.status(400).json({ ok: false, error: "Please enter a detailed message (minimum 5 characters)" });
    }

    const [ticket] = await db
      .insert(supportTickets)
      .values({
        name,
        email,
        subject,
        message,
        contactPhone,
        status: "open",
      })
      .returning();

    let emailSent = false;
    try {
      const emailResult = await sendSupportTicketEmail({
        name,
        email,
        subject,
        message,
        contactPhone,
      });
      emailSent = emailResult.ok === true;
    } catch (emailErr: unknown) {
      console.warn("[support/ticket] Ticket saved to DB, but email notification could not be sent:", emailErr);
    }

    return res.status(200).json({
      ok: true,
      ticketId: ticket?.id,
      emailSent,
      message: "Your support ticket has been logged in our system. Our team will review and get back to you shortly.",
    });
  } catch (err: unknown) {
    console.error("[support/ticket] Unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Failed to submit support request. Please try again." });
  }
}

/**
 * GET /api/support/tickets
 *
 * Lists submitted support tickets & complaints for admin review.
 */
export async function getSupportTicketsRoute(req: Request, res: Response) {
  try {
    const statusParam = typeof req.query?.status === "string" ? req.query.status.trim() : "";
    const searchParam = typeof req.query?.search === "string" ? req.query.search.trim().slice(0, 120) : "";
    const limitParam = Number.parseInt(String(req.query?.limit ?? "50"), 10);
    const offsetParam = Number.parseInt(String(req.query?.offset ?? "0"), 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 50;
    const offset = Number.isFinite(offsetParam) ? Math.max(offsetParam, 0) : 0;

    const conditions = [];
    if (statusParam && statusParam !== "all" && VALID_TICKET_STATUSES.includes(statusParam as TicketStatus)) {
      conditions.push(eq(supportTickets.status, statusParam));
    }
    if (searchParam) {
      const pattern = `%${searchParam}%`;
      const searchCond = or(
        ilike(supportTickets.name, pattern),
        ilike(supportTickets.email, pattern),
        ilike(supportTickets.subject, pattern),
        ilike(supportTickets.message, pattern),
      );
      if (searchCond) conditions.push(searchCond);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countRows] = await Promise.all([
      db
        .select()
        .from(supportTickets)
        .where(whereClause)
        .orderBy(desc(supportTickets.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({
          total: sql<number>`count(*)::int`,
          openCount: sql<number>`count(case when ${supportTickets.status} = 'open' then 1 end)::int`,
        })
        .from(supportTickets)
        .where(whereClause),
    ]);

    return res.status(200).json({
      ok: true,
      tickets: items,
      total: countRows[0]?.total ?? items.length,
      openCount: countRows[0]?.openCount ?? 0,
      limit,
      offset,
    });
  } catch (err: unknown) {
    console.error("[support/tickets/get] Unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Failed to load support tickets." });
  }
}

/**
 * PATCH /api/support/tickets/:id
 *
 * Updates a support ticket's status (open | in_progress | resolved | closed).
 */
export async function updateSupportTicketStatusRoute(req: Request, res: Response) {
  try {
    const id = typeof req.params?.id === "string" ? req.params.id.trim() : "";
    const nextStatus = typeof req.body?.status === "string" ? req.body.status.trim() : "";

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ ok: false, error: "Invalid ticket ID." });
    }
    if (!VALID_TICKET_STATUSES.includes(nextStatus as TicketStatus)) {
      return res.status(400).json({ ok: false, error: "Invalid ticket status." });
    }

    const [updated] = await db
      .update(supportTickets)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ ok: false, error: "Support ticket not found." });
    }

    return res.status(200).json({ ok: true, ticket: updated });
  } catch (err: unknown) {
    console.error("[support/tickets/patch] Unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Failed to update support ticket." });
  }
}


/**
 * POST /api/support/tickets/:id/reply
 *
 * Sends a founder reply email from support@foolioo.app to the user's email address
 * and optionally transitions the ticket status (e.g. to `in_progress` or `resolved`).
 */
export async function replySupportTicketRoute(req: Request, res: Response) {
  try {
    const id = typeof req.params?.id === "string" ? req.params.id.trim() : "";
    const replyMessage =
      typeof req.body?.replyMessage === "string" ? req.body.replyMessage.trim().slice(0, 5000) : "";
    const nextStatus =
      typeof req.body?.status === "string" &&
      VALID_TICKET_STATUSES.includes(req.body.status.trim() as TicketStatus)
        ? (req.body.status.trim() as TicketStatus)
        : null;

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return res.status(400).json({ ok: false, error: "Invalid ticket ID." });
    }
    if (!replyMessage || replyMessage.length < 2) {
      return res.status(400).json({ ok: false, error: "Please write a reply message before sending." });
    }

    const [existing] = await db
      .select()
      .from(supportTickets)
      .where(eq(supportTickets.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ ok: false, error: "Support ticket not found." });
    }

    await sendSupportReplyEmail({
      to: existing.email,
      recipientName: existing.name,
      ticketId: existing.id,
      subject: existing.subject,
      originalMessage: existing.message,
      replyMessage,
    });

    const targetStatus: TicketStatus =
      nextStatus ?? (existing.status === "open" ? "in_progress" : (existing.status as TicketStatus));

    const [updated] = await db
      .update(supportTickets)
      .set({ status: targetStatus, updatedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();

    return res.status(200).json({
      ok: true,
      sentTo: existing.email,
      from: "support@foolioo.app",
      ticket: updated ?? existing,
      message: `Reply sent to ${existing.email} from support@foolioo.app.`,
    });
  } catch (err: unknown) {
    console.error("[support/tickets/reply] Unexpected error:", err);
    return res.status(500).json({
      ok: false,
      error: "Failed to send reply email from support@foolioo.app. Check SMTP support settings.",
    });
  }
}
