import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env.js";

let authTransporter: Transporter | null = null;
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

function renderOtpEmailHtml(otp: string, purposeText: string, expiryMinutes = 10): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #FBF9F2;
      color: #1B1C18;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 520px;
      margin: 40px auto;
      background: #FFFFFF;
      border: 1px solid #EAE7DE;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(27, 28, 24, 0.04);
    }
    .header {
      padding: 32px 36px 20px;
      border-bottom: 1px solid #F3F1EB;
    }
    .logo-text {
      font-size: 26px;
      font-weight: 600;
      font-style: italic;
      color: #24231F;
      letter-spacing: -1px;
    }
    .logo-dot {
      color: #FD7032;
    }
    .content {
      padding: 36px;
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 12px;
      color: #1B1C18;
    }
    p {
      font-size: 14px;
      line-height: 22px;
      color: #55574F;
      margin: 0 0 24px;
    }
    .otp-box {
      background: #F8F6EF;
      border: 1px solid #E5E1D5;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 28px 0;
    }
    .otp-code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
      font-size: 36px;
      font-weight: 700;
      letter-spacing: 8px;
      color: #1B1C18;
      display: inline-block;
    }
    .note {
      font-size: 12px;
      line-height: 18px;
      color: #85877F;
      margin-top: 24px;
      border-top: 1px solid #F3F1EB;
      padding-top: 16px;
    }
    .footer {
      background: #FCFBF8;
      padding: 20px 36px;
      font-size: 11px;
      color: #92938D;
      border-top: 1px solid #EAE7DE;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="logo-text">foolioo<span class="logo-dot">.</span></span>
    </div>
    <div class="content">
      <h1>Verification Code</h1>
      <p>Use the 6-digit code below to ${purposeText}. This code expires in <strong>${expiryMinutes} minutes</strong>.</p>
      
      <div class="otp-box">
        <span class="otp-code">${otp}</span>
      </div>

      <p class="note">
        If you did not request this verification code, please ignore this email or contact support at support@foolioo.app if you have concerns. Never share this code with anyone.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} Foolioo. Voice Operations Platform. All rights reserved.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Sends authentication verification OTP from auth@foolioo.app
 */
export async function sendAuthOtpEmail(options: {
  to: string;
  otp: string;
  displayName?: string;
  expiryMinutes?: number;
}): Promise<{ ok: boolean; messageId?: string; simulated?: boolean }> {
  const { to, otp, expiryMinutes = 10 } = options;
  const transporter = getAuthTransporter();

  const subject = `Your Foolioo verification code: ${otp}`;
  const text = `Your Foolioo verification code is: ${otp}\n\nThis code will expire in ${expiryMinutes} minutes.\nNever share this code with anyone.\n\n- The Foolioo Team`;
  const html = renderOtpEmailHtml(otp, "verify your Foolioo account", expiryMinutes);

  if (!transporter) {
    console.log(`[nodemailer/dev-fallback] 📧 [AUTH FROM auth@foolioo.app] -> To: ${to} | OTP: ${otp}`);
    return { ok: true, simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: env.smtp.authFrom,
      to,
      subject,
      text,
      html,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err: unknown) {
    console.error("[nodemailer/auth] Failed to send auth OTP email:", err);
    throw err;
  }
}

/**
 * Sends support endpoint verification OTP from support@foolioo.app
 */
export async function sendSupportOtpEmail(options: {
  to: string;
  otp: string;
  displayName?: string;
  expiryMinutes?: number;
}): Promise<{ ok: boolean; messageId?: string; simulated?: boolean }> {
  const { to, otp, expiryMinutes = 10 } = options;
  const transporter = getSupportTransporter();

  const subject = `Your Foolioo support verification code: ${otp}`;
  const text = `Your Foolioo support verification code is: ${otp}\n\nThis code will expire in ${expiryMinutes} minutes.\nNever share this code with anyone.\n\n- Foolioo Support Team`;
  const html = renderOtpEmailHtml(otp, "authenticate your support request", expiryMinutes);

  if (!transporter) {
    console.log(`[nodemailer/dev-fallback] 📧 [SUPPORT FROM support@foolioo.app] -> To: ${to} | Support OTP: ${otp}`);
    return { ok: true, simulated: true };
  }

  try {
    const info = await transporter.sendMail({
      from: env.smtp.supportFrom,
      to,
      subject,
      text,
      html,
    });
    return { ok: true, messageId: info.messageId };
  } catch (err: unknown) {
    console.error("[nodemailer/support] Failed to send support OTP email:", err);
    throw err;
  }
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
