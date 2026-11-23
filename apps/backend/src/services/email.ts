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

export function buildAuthOtpEmailHtml(otp: string): string {
  const currentYear = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Foolioo Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F8F7F3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #F8F7F3; padding: 48px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #FFFFFF; border: 1px solid #EAE7DE; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(27, 28, 24, 0.04);">
          <!-- Header with Brandmark & Badge -->
          <tr>
            <td style="padding: 32px 36px 20px 36px; border-bottom: 1px solid #F0EEE6;">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td>
                    <span style="font-size: 26px; font-weight: 700; letter-spacing: -0.6px; color: #1B1C18; text-decoration: none;">
                      Foolioo<span style="color: #FD7032;">.</span>
                    </span>
                  </td>
                  <td align="right">
                    <span style="display: inline-block; padding: 5px 12px; background-color: #F4F0FF; border: 1px solid #E7DEFF; border-radius: 20px; font-size: 11px; font-weight: 600; color: #644ABB; text-transform: uppercase; letter-spacing: 0.8px;">
                      Security Verification
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 36px 24px 36px;">
              <h1 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 600; letter-spacing: -0.3px; color: #1B1C18; line-height: 1.3;">
                Confirm your email address
              </h1>
              <p style="margin: 0 0 28px 0; font-size: 14px; line-height: 22px; color: #666862;">
                Thank you for choosing Foolioo. To complete your verification and securely access your voice workspace, please use the 6-digit code below:
              </p>

              <!-- Elegant OTP Display -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 28px;">
                <tr>
                  <td align="center" style="background-color: #F8F6EF; border: 1.5px solid #E6E2D5; border-radius: 12px; padding: 24px 16px;">
                    <div style="font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 38px; font-weight: 700; letter-spacing: 12px; color: #1B1C18; padding-left: 12px;">
                      ${otp}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Expiry Alert Callout -->
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FFFDF5; border: 1px solid #F5E8C7; border-radius: 8px; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="vertical-align: top; padding-right: 10px; font-size: 14px; line-height: 18px;">
                          ⏱️
                        </td>
                        <td style="font-size: 12px; line-height: 18px; color: #8A6D2B;">
                          This code expires in <strong>10 minutes</strong>. For your protection, never share this code with anyone. Foolioo will never call or ask you for your verification code.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; font-size: 13px; line-height: 20px; color: #85877F;">
                If you did not make this request, you can safely disregard this email or report it to <a href="mailto:support@foolioo.app" style="color: #7852D6; text-decoration: underline;">support@foolioo.app</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px 28px 36px; background-color: #FAF9F5; border-top: 1px solid #F0EEE6; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 12px; line-height: 18px; color: #85877F;">
                Foolioo &bull; Autonomous Outbound Voice Operations
              </p>
              <p style="margin: 0; font-size: 11px; color: #A0A29C;">
                &copy; ${currentYear} Foolioo. All rights reserved. Sent securely from auth@foolioo.app
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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

  const html = buildAuthOtpEmailHtml(otp);

  try {
    await transporter.sendMail({
      from: env.smtp.authFrom,
      to,
      subject: `${otp} is your Foolioo verification code`,
      text: `Your Foolioo verification code is ${otp}. It will expire in 10 minutes.`,
      html,
    });
    return { ok: true };
  } catch (err: unknown) {
    console.error("[nodemailer/auth] Failed to send auth OTP email:", err);
    if (!env.isProduction) {
      console.log(`[nodemailer/dev-fallback] 📧 [AUTH OTP] To: ${to} | Code: ${otp}`);
      return { ok: true };
    }
    throw err;
  }
}

export async function sendPasswordResetOtpEmail(options: {
  to: string;
  otp: string;
}): Promise<{ ok: boolean }> {
  const { to, otp } = options;
  const transporter = getAuthTransporter();

  if (!transporter) {
    console.log(`[nodemailer/dev-fallback] 📧 [PASSWORD RESET OTP] To: ${to} | Code: ${otp}`);
    return { ok: true };
  }

  try {
    await transporter.sendMail({
      from: env.smtp.authFrom,
      to,
      subject: `${otp} is your Foolioo password reset code`,
      text: `Your Foolioo password reset code is ${otp}. It will expire in 10 minutes.`,
      html: buildAuthOtpEmailHtml(otp).replace("Confirm your email address", "Reset your password").replace(
        "Thank you for choosing Foolioo. To complete your verification and securely access your voice workspace",
        "Use the 6-digit code below to securely reset your Foolioo password",
      ),
    });
    return { ok: true };
  } catch (err: unknown) {
    console.error("[nodemailer/auth] Failed to send password reset OTP email:", err);
    if (!env.isProduction) {
      console.log(`[nodemailer/dev-fallback] 📧 [PASSWORD RESET OTP] To: ${to} | Code: ${otp}`);
      return { ok: true };
    }
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
    if (!env.isProduction) {
      console.log(`[nodemailer/dev-fallback] 📧 [SUPPORT OTP] To: ${to} | Code: ${otp}`);
      return { ok: true };
    }
    throw err;
  }
}
