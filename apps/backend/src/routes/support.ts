import type { Request, Response } from "express";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "../config/db.js";
import { emailVerificationOtps } from "@repo/db";
import {
  generateNumericOtp,
  hashOtp,
  verifyOtpHash,
  OTP_EXPIRY_MINUTES,
  MAX_OTP_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
} from "../utils/otp.js";
import { sendSupportOtpEmail, sendSupportTicketEmail } from "../services/email.js";

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

    await sendSupportTicketEmail({
      name,
      email,
      subject,
      message,
      contactPhone,
    });

    return res.status(200).json({
      ok: true,
      message: "Your support request has been submitted. A confirmation has been sent to your email from support@foolioo.app.",
    });
  } catch (err: unknown) {
    console.error("[support/ticket] Unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Failed to submit support request. Please try again." });
  }
}

/**
 * POST /api/support/otp/send
 *
 * Sends a 6-digit verification code from support@foolioo.app for verifying support actions.
 */
export async function sendSupportOtpRoute(req: Request, res: Response) {
  try {
    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return res.status(400).json({ ok: false, error: "A valid email address is required" });
    }

    const cooldownThreshold = new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000);
    const [recentOtp] = await db
      .select({ createdAt: emailVerificationOtps.createdAt })
      .from(emailVerificationOtps)
      .where(
        and(
          eq(emailVerificationOtps.email, rawEmail),
          eq(emailVerificationOtps.purpose, "support_verification"),
          gt(emailVerificationOtps.createdAt, cooldownThreshold)
        )
      )
      .orderBy(desc(emailVerificationOtps.createdAt))
      .limit(1);

    if (recentOtp) {
      return res.status(429).json({
        ok: false,
        error: `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code.`,
      });
    }

    const otp = generateNumericOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await db.insert(emailVerificationOtps).values({
      email: rawEmail,
      userId: req.user?.id ?? null,
      otpHash,
      purpose: "support_verification",
      expiresAt,
      attempts: 0,
    });

    await sendSupportOtpEmail({
      to: rawEmail,
      otp,
      expiryMinutes: OTP_EXPIRY_MINUTES,
    });

    return res.status(200).json({
      ok: true,
      message: `Support verification code sent to ${rawEmail} from support@foolioo.app`,
      expiryMinutes: OTP_EXPIRY_MINUTES,
    });
  } catch (err: unknown) {
    console.error("[support/otp/send] Unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Failed to send support verification code." });
  }
}

/**
 * POST /api/support/otp/verify
 *
 * Verifies a support OTP code issued by support@foolioo.app.
 */
export async function verifySupportOtpRoute(req: Request, res: Response) {
  try {
    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const rawOtp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";

    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return res.status(400).json({ ok: false, error: "A valid email address is required" });
    }
    if (!rawOtp || !/^\d{6}$/.test(rawOtp)) {
      return res.status(400).json({ ok: false, error: "A valid 6-digit code is required" });
    }

    const [activeRecord] = await db
      .select()
      .from(emailVerificationOtps)
      .where(
        and(
          eq(emailVerificationOtps.email, rawEmail),
          eq(emailVerificationOtps.purpose, "support_verification"),
          isNull(emailVerificationOtps.consumedAt),
          gt(emailVerificationOtps.expiresAt, new Date())
        )
      )
      .orderBy(desc(emailVerificationOtps.createdAt))
      .limit(1);

    if (!activeRecord) {
      return res.status(400).json({
        ok: false,
        error: "Verification code has expired or is invalid. Please request a new code.",
      });
    }

    if (activeRecord.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        ok: false,
        error: "Too many failed attempts. Please request a new verification code.",
      });
    }

    const isValid = verifyOtpHash(rawOtp, activeRecord.otpHash);
    if (!isValid) {
      await db
        .update(emailVerificationOtps)
        .set({ attempts: activeRecord.attempts + 1 })
        .where(eq(emailVerificationOtps.id, activeRecord.id));

      const remaining = Math.max(0, MAX_OTP_ATTEMPTS - (activeRecord.attempts + 1));
      return res.status(400).json({
        ok: false,
        error: `Incorrect verification code. ${remaining > 0 ? `${remaining} attempts remaining.` : "Please request a new code."}`,
      });
    }

    await db
      .update(emailVerificationOtps)
      .set({
        consumedAt: new Date(),
        attempts: activeRecord.attempts + 1,
      })
      .where(eq(emailVerificationOtps.id, activeRecord.id));

    return res.status(200).json({
      ok: true,
      verified: true,
      message: "Support verification successful.",
    });
  } catch (err: unknown) {
    console.error("[support/otp/verify] Unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Failed to verify code." });
  }
}
