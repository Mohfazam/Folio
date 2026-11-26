import type { Request, Response } from "express";
import { db } from "../config/db.js";
import { supportTickets } from "@repo/db";
import { sendSupportTicketEmail } from "../services/email.js";

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
