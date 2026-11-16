import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";

let supportTransporter: Transporter | null = null;

function createTransporter(user: string, pass: string): Transporter | null {
  if (!env.smtp.host) {
    return null;
  }

  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure || env.smtp.port === 465,
    auth: {
      user: user || env.smtp.authUser,
      pass: pass || env.smtp.authPass,
    },
    tls: {
      rejectUnauthorized: env.isProduction,
    },
  });
}

export function getSupportTransporter(): Transporter | null {
  if (!supportTransporter && env.smtp.host) {
    supportTransporter = createTransporter(env.smtp.supportUser, env.smtp.supportPass);
  }
  return supportTransporter;
}

/**
 * Sends a support ticket receipt and notification from support@foolioo.app
 */
export async function sendSupportTicketEmail(options: {
  name: string;
  email: string;
  subject: string;
  message: string;
  contactPhone?: string | null;
}): Promise<{ ok: boolean }> {
  const { name, email, subject, message, contactPhone } = options;
  const transporter = getSupportTransporter();

  if (!transporter) {
    console.log(`[nodemailer/dev-fallback] 📧 [SUPPORT TICKET] From: ${name} <${email}> | Subject: ${subject}`);
    return { ok: true };
  }

  // 1. Send confirmation to user
  const userHtml = `<div style="font-family: sans-serif; max-width: 520px; margin: 20px auto; color: #1B1C18;">
    <h2>We received your support request</h2>
    <p>Hi ${name},</p>
    <p>Thank you for reaching out to Foolioo support. We've received your inquiry regarding <strong>"${subject}"</strong> and our team will get back to you shortly.</p>
    <div style="background: #F8F6EF; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #EAE7DE;">
      <strong>Your message:</strong>
      <p style="margin: 8px 0 0; white-space: pre-wrap; font-size: 13px;">${message}</p>
    </div>
    <p style="font-size: 12px; color: #85877F;">- Foolioo Support Team</p>
  </div>`;

  // 2. Send ticket notification to support team
  const adminHtml = `<div style="font-family: sans-serif; max-width: 600px; margin: 20px auto; color: #1B1C18;">
    <h2>New Support Ticket</h2>
    <p><strong>From:</strong> ${name} (&lt;${email}&gt;)</p>
    ${contactPhone ? `<p><strong>Phone:</strong> ${contactPhone}</p>` : ""}
    <p><strong>Subject:</strong> ${subject}</p>
    <div style="background: #F8F6EF; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #EAE7DE;">
      <strong>Message:</strong>
      <p style="margin: 8px 0 0; white-space: pre-wrap;">${message}</p>
    </div>
  </div>`;

  try {
    await Promise.all([
      transporter.sendMail({
        from: env.smtp.supportFrom,
        to: email,
        subject: `[Support Ticket Received] ${subject}`,
        html: userHtml,
      }),
      transporter.sendMail({
        from: env.smtp.supportFrom,
        to: env.smtp.supportUser,
        replyTo: email,
        subject: `[Ticket] ${subject} - ${name}`,
        html: adminHtml,
      }),
    ]);
    return { ok: true };
  } catch (err: unknown) {
    console.error("[nodemailer/support] Failed to send support ticket email:", err);
    throw err;
  }
}
