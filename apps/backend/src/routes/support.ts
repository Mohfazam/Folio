import type { Request, Response } from "express";
import { db } from "../config/db.js";
import { supportTickets } from "@repo/db";
import { sendSupportTicketEmail } from "../services/email.js";

/**
 * POST /api/support/ticket
 *
 * Submits a customer support inquiry, sending user acknowledgment and team notification from support@foolioo.app.
 */
export async function submitSupportTicketRoute(req: Request, res: Response) {
  try {
    const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 100) : "";
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const subject = typeof req.body?.subject === "string" ? req.body.subject.trim().slice(0, 200) : "";
    const message = typeof req.body?.message === "string" ? req.body.message.trim().slice(0, 5000) : "";
    const contactPhone = typeof req.body?.contactPhone === "string" ? req.body.contactPhone.trim().slice(0, 40) : null;

    if (!name) {
      return res.status(400).json({ ok: false, error: "Your name is required" });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "A valid email address is required" });
    }
    if (!subject) {
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

    await sendSupportTicketEmail({
      name,
      email,
      subject,
      message,
      contactPhone,
    });

    return res.status(200).json({
      ok: true,
      ticketId: ticket?.id,
      message: "Your support request has been submitted. A confirmation has been sent to your email from support@foolioo.app.",
    });
  } catch (err: unknown) {
    console.error("[support/ticket] Unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Failed to submit support request. Please try again." });
  }
}
