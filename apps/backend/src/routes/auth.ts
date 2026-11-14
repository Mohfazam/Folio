import type { Request, Response } from "express";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { clients, emailVerificationOtps, users } from "@repo/db";
import {
  generateNumericOtp,
  hashOtp,
  verifyOtpHash,
  OTP_EXPIRY_MINUTES,
  MAX_OTP_ATTEMPTS,
  OTP_RESEND_COOLDOWN_SECONDS,
} from "../utils/otp.js";
import { sendAuthOtpEmail } from "../services/email.js";

function metadataString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function publicUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    clientId: user.clientId,
    email: user.email,
    phoneNumber: user.phoneNumber,
    phoneVerified: user.phoneVerified,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    authProvider: user.authProvider,
    role: user.role,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function readProfile(req: Request) {
  const authUser = req.supabaseUser!;
  const metadata = authUser.user_metadata;
  const phoneNumber = authUser.phone_confirmed_at ? authUser.phone : null;
  const email = metadataString(authUser.email)?.trim().toLowerCase() ?? null;

  return {
    authUserId: authUser.id,
    email,
    emailVerified: Boolean(authUser.email_confirmed_at),
    phoneNumber,
    phoneVerified: phoneNumber !== null,
    displayName: metadataString(metadata.full_name) ?? metadataString(metadata.name),
    avatarUrl: metadataString(metadata.avatar_url) ?? metadataString(metadata.picture),
    authProvider: metadataString(authUser.app_metadata.provider) ?? "email",
  };
}

/**
 * POST /api/auth/sync
 *
 * Provisions the signed-in Supabase identity and its initial workspace.
 * Profile identity fields are sourced from the verified Supabase user.
 */
export async function syncAuthUserRoute(req: Request, res: Response) {
  try {
    if (!req.supabaseUser) {
      return res.status(401).json({ ok: false, error: "Verified Supabase identity is required" });
    }

    const profile = readProfile(req);
    const organizationName =
      typeof req.body?.organizationName === "string"
        ? req.body.organizationName.trim().slice(0, 120)
        : "";
    const emailLocalPart = profile.email?.split("@")[0]?.slice(0, 120);
    const clientName =
      organizationName || profile.displayName?.slice(0, 120) || emailLocalPart || "My Organization";

    const [existingByUid] = await db
      .select()
      .from(users)
      .where(eq(users.authUserId, profile.authUserId))
      .limit(1);

    const [existingByEmail] =
      !existingByUid && profile.email
        ? await db
        .select({ id: users.id, authUserId: users.authUserId })
        .from(users)
        .where(sql`lower(${users.email}) = ${profile.email}`)
        .limit(1)
        : [];

    if (existingByEmail && !profile.emailVerified) {
      return res.status(409).json({
        ok: false,
        error: "Verify your email before linking this sign-in to an existing account",
      });
    }

    if (
      existingByEmail?.authUserId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existingByEmail.authUserId) &&
      existingByEmail.authUserId !== profile.authUserId
    ) {
      return res.status(409).json({
        ok: false,
        error: "This email is already associated with another sign-in identity",
      });
    }

    const result = await db.transaction(async (tx) => {
      const [emailMatchedUser] = existingByEmail
        ? await tx.select().from(users).where(eq(users.id, existingByEmail.id)).limit(1)
        : [];
      const existingUser = existingByUid ?? emailMatchedUser;
      let clientId = existingUser?.clientId ?? null;

      if (clientId) {
        const [existingClient] = await tx
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.id, clientId))
          .limit(1);
        if (!existingClient) clientId = null;
      }

      if (!clientId) {
        const [client] = await tx
          .insert(clients)
          .values({
            name: clientName,
            contactPersonName: profile.displayName,
            contactEmail: profile.email,
            contactPhone: profile.phoneNumber,
            isPhoneVerified: profile.phoneVerified,
            callingHoursStart: "09:00:00",
            callingHoursEnd: "18:00:00",
            timezone: "Asia/Kolkata",
            planTier: "trial",
            monthlyCreditsAllowance: 360,
            maxCallsPerDay: 50,
            status: "trialing",
          })
          .returning({ id: clients.id });
        clientId = client?.id ?? null;
      }

      if (!clientId) {
        throw new Error("Failed to provision a workspace");
      }

      const [user] = existingUser
        ? await tx
            .update(users)
            .set({
              clientId,
              authUserId: profile.authUserId,
              email: profile.email ?? existingUser.email,
              phoneNumber: profile.phoneNumber ?? existingUser.phoneNumber,
              phoneVerified: profile.phoneVerified || existingUser.phoneVerified,
              emailVerified: profile.emailVerified || existingUser.emailVerified,
              displayName: profile.displayName ?? existingUser.displayName,
              avatarUrl: profile.avatarUrl ?? existingUser.avatarUrl,
              authProvider: profile.authProvider,
              lastLoginAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(users.id, existingUser.id))
            .returning()
        : await tx
            .insert(users)
            .values({
              authUserId: profile.authUserId,
              clientId,
              email: profile.email,
              phoneNumber: profile.phoneNumber,
              phoneVerified: profile.phoneVerified,
              emailVerified: profile.emailVerified,
              displayName: profile.displayName,
              avatarUrl: profile.avatarUrl,
              authProvider: profile.authProvider,
              role: "client_admin",
              lastLoginAt: new Date(),
            })
            .returning();

      if (!user) {
        throw new Error("Failed to provision a user profile");
      }

      const [client] = await tx.select().from(clients).where(eq(clients.id, clientId)).limit(1);
      if (!client) {
        throw new Error("Failed to load the provisioned workspace");
      }
      return { user, client };
    });

    return res.status(200).json({
      ok: true,
      user: publicUser(result.user),
      client: result.client,
      requiresPhoneVerification: !result.user.phoneNumber || !result.user.phoneVerified,
    });
  } catch (err: unknown) {
    console.error("[auth/sync] Unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * GET /api/auth/me
 */
export async function getAuthMeRoute(req: Request, res: Response) {
  if (!req.user) {
    return res.status(404).json({ ok: false, error: "User profile not found; sync the account first" });
  }

  try {
    const [client] = req.user.clientId
      ? await db.select().from(clients).where(eq(clients.id, req.user.clientId)).limit(1)
      : [null];

    return res.json({
      ok: true,
      user: publicUser(req.user),
      client,
      hasVerifiedPhone: Boolean(req.user.phoneNumber && req.user.phoneVerified),
    });
  } catch (err: unknown) {
    console.error("[auth/me] Unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Unable to load user profile" });
  }
}

/**
 * PATCH /api/auth/phone
 *
 * Store only a phone number asserted by Supabase's verified user record.
 */
export async function updateAuthPhoneRoute(req: Request, res: Response) {
  const profile = req.supabaseUser ? readProfile(req) : undefined;
  if (!profile?.phoneNumber || !req.user) {
    return res.status(403).json({
      ok: false,
      error: "A verified Supabase phone sign-in and an existing user profile are required",
    });
  }

  try {
    const updatedUser = await db.transaction(async (tx) => {
      const [user] = await tx
        .update(users)
        .set({
          phoneNumber: profile.phoneNumber,
          phoneVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, req.user!.id))
        .returning();

      if (user?.clientId) {
        await tx
          .update(clients)
          .set({
            contactPhone: profile.phoneNumber,
            isPhoneVerified: true,
            updatedAt: new Date(),
          })
          .where(eq(clients.id, user.clientId));
      }

      return user;
    });

    return res.json({ ok: true, user: updatedUser ? publicUser(updatedUser) : null });
  } catch (err: unknown) {
    console.error("[auth/phone] Unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Unable to update verified phone number" });
  }
}

/**
 * POST /api/auth/otp/send
 *
 * Sends a 6-digit email verification OTP from auth@foolioo.app.
 */
export async function sendAuthOtpRoute(req: Request, res: Response) {
  try {
    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return res.status(400).json({ ok: false, error: "A valid email address is required" });
    }

    // Rate-limit resends: check if an OTP was sent within the last OTP_RESEND_COOLDOWN_SECONDS
    const cooldownThreshold = new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000);
    const [recentOtp] = await db
      .select({ createdAt: emailVerificationOtps.createdAt })
      .from(emailVerificationOtps)
      .where(
        and(
          eq(emailVerificationOtps.email, rawEmail),
          eq(emailVerificationOtps.purpose, "auth_verification"),
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

    // Optional user association
    const [matchedUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${rawEmail}`)
      .limit(1);

    const otp = generateNumericOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await db.insert(emailVerificationOtps).values({
      email: rawEmail,
      userId: matchedUser?.id ?? null,
      otpHash,
      purpose: "auth_verification",
      expiresAt,
      attempts: 0,
    });

    await sendAuthOtpEmail({
      to: rawEmail,
      otp,
      expiryMinutes: OTP_EXPIRY_MINUTES,
    });

    return res.status(200).json({
      ok: true,
      message: `Verification code sent to ${rawEmail}`,
      expiryMinutes: OTP_EXPIRY_MINUTES,
    });
  } catch (err: unknown) {
    console.error("[auth/otp/send] Unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Failed to send verification code. Please try again." });
  }
}

/**
 * POST /api/auth/otp/verify
 *
 * Verifies the 6-digit OTP and marks the account's email as verified.
 */
export async function verifyAuthOtpRoute(req: Request, res: Response) {
  try {
    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const rawOtp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";

    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return res.status(400).json({ ok: false, error: "A valid email address is required" });
    }
    if (!rawOtp || !/^\d{6}$/.test(rawOtp)) {
      return res.status(400).json({ ok: false, error: "A valid 6-digit verification code is required" });
    }

    const [activeRecord] = await db
      .select()
      .from(emailVerificationOtps)
      .where(
        and(
          eq(emailVerificationOtps.email, rawEmail),
          eq(emailVerificationOtps.purpose, "auth_verification"),
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

    // Mark OTP as consumed
    await db
      .update(emailVerificationOtps)
      .set({
        consumedAt: new Date(),
        attempts: activeRecord.attempts + 1,
      })
      .where(eq(emailVerificationOtps.id, activeRecord.id));

    // Update user record if present
    await db
      .update(users)
      .set({
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(sql`lower(${users.email}) = ${rawEmail}`);

    return res.status(200).json({
      ok: true,
      verified: true,
      message: "Email verified successfully.",
    });
  } catch (err: unknown) {
    console.error("[auth/otp/verify] Unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Failed to verify code. Please try again." });
  }
}

