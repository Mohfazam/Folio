import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";

let supportTransporter: Transporter | null = null;
let authTransporter: Transporter | null = null;

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

export function getAuthTransporter(): Transporter | null {
  if (!authTransporter && env.smtp.host) {
    authTransporter = createTransporter(env.smtp.authUser, env.smtp.authPass);
  }
  return authTransporter;
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

/**
 * Sends an authentication OTP code email.
 */
export async function sendAuthOtpEmail(options: {
  to: string;
  otp: string;
}): Promise<{ ok: boolean }> {
  const { to, otp } = options;
  const transporter = getAuthTransporter();

  if (!transporter) {
    console.log(`[nodemailer/dev-fallback] 📧 [AUTH OTP] To: ${to} | Code: ${otp}`);
    return { ok: true };
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1B1C18; background-color: #FFFFFF; border: 1px solid #EAE7DE; border-radius: 12px;">
      <div style="margin-bottom: 24px;">
        <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #7852D6;">Foolioo Security</span>
      </div>
      <h2 style="font-size: 24px; font-weight: 600; margin: 0 0 12px; color: #1B1C18;">Verify your email address</h2>
      <p style="font-size: 14px; line-height: 22px; color: #747878; margin: 0 0 24px;">
        Enter the following 6-digit verification code to confirm your email and access your Foolioo workspace:
      </p>
      <div style="background-color: #F8F6EF; border: 1px solid #E9E8E1; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <span style="font-family: monospace; font-size: 32px; font-weight: 700; letter-spacing: 10px; color: #1B1C18;">${otp}</span>
      </div>
      <p style="font-size: 12px; line-height: 18px; color: #85877F; margin: 0 0 16px;">
        This code expires in 10 minutes. If you did not request this verification, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #EAE7DE; margin: 24px 0 16px;" />
      <p style="font-size: 11px; color: #A0A29C; margin: 0;">
        &copy; ${new Date().getFullYear()} Foolioo Voice Operations. Sent from auth@foolioo.app
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: env.smtp.authFrom,
      to,
      subject: `Your Foolioo verification code: ${otp}`,
      text: `Your Foolioo verification code is ${otp}. It will expire in 10 minutes.`,
      html,
    });
    return { ok: true };
  } catch (err: unknown) {
    console.error("[nodemailer/auth] Failed to send auth OTP email:", err);
    throw err;
  }
}

/**
 * Sends a support OTP code email.
 */
export async function sendSupportOtpEmail(options: {
  to: string;
  otp: string;
}): Promise<{ ok: boolean }> {
  const { to, otp } = options;
  const transporter = getSupportTransporter();

  if (!transporter) {
    console.log(`[nodemailer/dev-fallback] 📧 [SUPPORT OTP] To: ${to} | Code: ${otp}`);
    return { ok: true };
  }

  try {
    await transporter.sendMail({
      from: env.smtp.supportFrom,
      to,
      subject: `Your support verification code: ${otp}`,
      text: `Your Foolioo support verification code is ${otp}.`,
    });
    return { ok: true };
  } catch (err: unknown) {
    console.error("[nodemailer/support] Failed to send support OTP email:", err);
    throw err;
  }
}
