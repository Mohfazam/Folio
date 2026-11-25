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
import { hashPassword, verifyPassword } from "../utils/passwords.js";
import { signAuthToken } from "../utils/tokens.js";
import { sendAuthOtpEmail, sendPasswordResetOtpEmail } from "../services/email.js";
import { enforceTrialExpiration } from "../services/trialExpiration.js";

function metadataString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

async function invalidateActiveOtps(email: string, purpose: string) {
  await db
    .update(emailVerificationOtps)
    .set({ consumedAt: new Date() })
    .where(
      and(
        sql`lower(${emailVerificationOtps.email}) = ${email}`,
        eq(emailVerificationOtps.purpose, purpose),
        isNull(emailVerificationOtps.consumedAt),
      ),
    );
}

export function publicUser(user: typeof users.$inferSelect) {
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
 * Provisions a workspace/client for a user if they do not already have one.
 */
async function ensureWorkspace(userId: string, userEmail: string | null, displayName: string | null) {
  return db.transaction(async (tx) => {
    const [currentUser] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!currentUser) throw new Error("User not found");

    if (currentUser.clientId) {
      const [existingClient] = await tx
        .select()
        .from(clients)
        .where(eq(clients.id, currentUser.clientId))
        .limit(1);
      if (existingClient) {
        return { user: currentUser, client: existingClient };
      }
    }

    const clientName = displayName || userEmail?.split("@")[0] || "My Organization";
    const [client] = await tx
      .insert(clients)
      .values({
        name: clientName,
        contactPersonName: displayName,
        contactEmail: userEmail,
        callingHoursStart: "09:00:00",
        callingHoursEnd: "18:00:00",
        timezone: "Asia/Kolkata",
        planTier: "trial",
        monthlyCreditsAllowance: 360,
        maxCallsPerDay: 50,
        status: "trialing",
      })
      .returning();

    if (!client) throw new Error("Failed to create workspace client");

    const [updatedUser] = await tx
      .update(users)
      .set({
        clientId: client.id,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) throw new Error("Failed to update user with workspace");

    return { user: updatedUser, client };
  });
}

/**
 * POST /api/auth/register
 *
 * Direct email + password registration with Nodemailer OTP verification.
 */
export async function registerUserRoute(req: Request, res: Response) {
  try {
    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const rawPassword = typeof req.body?.password === "string" ? req.body.password : "";
    const rawName = typeof req.body?.name === "string" ? req.body.name.trim() : "";

    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return res.status(400).json({ ok: false, error: "A valid work email address is required" });
    }
    if (!rawPassword || rawPassword.length < 8) {
      return res.status(400).json({ ok: false, error: "Password must be at least 8 characters long" });
    }

    const [existing] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${rawEmail}`)
      .limit(1);

    if (existing && existing.emailVerified) {
      return res.status(409).json({ ok: false, error: "An account with this email already exists." });
    }

    const passwordHash = hashPassword(rawPassword);
    const displayName = rawName || rawEmail.split("@")[0];

    let userId: string;
    if (existing) {
      await db
        .update(users)
        .set({
          passwordHash,
          displayName,
          authProvider: "email",
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id));
      userId = existing.id;
    } else {
      const [created] = await db
        .insert(users)
        .values({
          email: rawEmail,
          displayName,
          passwordHash,
          authProvider: "email",
          emailVerified: false,
          role: "client_admin",
        })
        .returning({ id: users.id });
      userId = created!.id;
    }

    const otp = generateNumericOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await invalidateActiveOtps(rawEmail, "auth_verification");
    await db.insert(emailVerificationOtps).values({
      email: rawEmail,
      userId,
      otpHash,
      purpose: "auth_verification",
      expiresAt,
      attempts: 0,
    });

    await sendAuthOtpEmail({
      to: rawEmail,
      otp,
    });

    return res.status(200).json({
      ok: true,
      message: `Verification code sent to ${rawEmail}`,
      expiryMinutes: OTP_EXPIRY_MINUTES,
    });
  } catch (err: unknown) {
    console.error("[auth/register] Unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Could not create account. Please try again." });
  }
}

/**
 * POST /api/auth/otp/send
 *
 * Generates and sends a 6-digit verification code to the given email via Nodemailer.
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
          sql`lower(${emailVerificationOtps.email}) = ${rawEmail}`,
          eq(emailVerificationOtps.purpose, "auth_verification"),
          gt(emailVerificationOtps.createdAt, cooldownThreshold),
        ),
      )
      .orderBy(desc(emailVerificationOtps.createdAt))
      .limit(1);

    if (recentOtp) {
      return res.status(429).json({
        ok: false,
        error: `Please wait ${OTP_RESEND_COOLDOWN_SECONDS} seconds before requesting another code.`,
      });
    }

    const [matchedUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${rawEmail}`)
      .limit(1);

    const otp = generateNumericOtp();
    const otpHash = hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await invalidateActiveOtps(rawEmail, "auth_verification");
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
 * Verifies the 6-digit OTP, marks email as verified, provisions workspace, and returns a session JWT.
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
          sql`lower(${emailVerificationOtps.email}) = ${rawEmail}`,
          eq(emailVerificationOtps.purpose, "auth_verification"),
          isNull(emailVerificationOtps.consumedAt),
          gt(emailVerificationOtps.expiresAt, new Date()),
        ),
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

    // Update user record: mark emailVerified = true
    const [user] = await db
      .update(users)
      .set({
        emailVerified: true,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(sql`lower(${users.email}) = ${rawEmail}`)
      .returning();

    if (!user) {
      return res.status(404).json({ ok: false, error: "User account not found." });
    }

    // Ensure workspace is provisioned
    const { user: finalizedUser, client } = await ensureWorkspace(user.id, user.email, user.displayName);

    const token = signAuthToken({
      userId: finalizedUser.id,
      email: finalizedUser.email,
      clientId: finalizedUser.clientId,
      role: finalizedUser.role,
      authProvider: finalizedUser.authProvider || "email",
    });

    return res.status(200).json({
      ok: true,
      verified: true,
      token,
      user: publicUser(finalizedUser),
      client,
    });
  } catch (err: unknown) {
    console.error("[auth/otp/verify] Unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Failed to verify code. Please try again." });
  }
}

/**
 * POST /api/auth/login
 *
 * Direct email + password authentication. Issues an App JWT session.
 */
export async function loginUserRoute(req: Request, res: Response) {
  try {
    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const rawPassword = typeof req.body?.password === "string" ? req.body.password : "";

    if (!rawEmail || !rawPassword) {
      return res.status(400).json({ ok: false, error: "Email and password are required." });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${rawEmail}`)
      .limit(1);

    if (!user || !user.passwordHash) {
      return res.status(401).json({ ok: false, error: "Invalid email or password." });
    }

    const passwordMatches = verifyPassword(rawPassword, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ ok: false, error: "Invalid email or password." });
    }

    if (!user.emailVerified) {
      // Auto-trigger a fresh OTP so user can verify immediately
      const otp = generateNumericOtp();
      const otpHash = hashOtp(otp);
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      await invalidateActiveOtps(rawEmail, "auth_verification");
      await db.insert(emailVerificationOtps).values({
        email: rawEmail,
        userId: user.id,
        otpHash,
        purpose: "auth_verification",
        expiresAt,
        attempts: 0,
      });

      await sendAuthOtpEmail({ to: rawEmail, otp });

      return res.status(403).json({
        ok: false,
        requiresVerification: true,
        error: "Your email is not verified. We sent a verification code to your email.",
      });
    }

    // Ensure workspace
    const { user: finalizedUser, client } = await ensureWorkspace(user.id, user.email, user.displayName);

    await db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, finalizedUser.id));

    const token = signAuthToken({
      userId: finalizedUser.id,
      email: finalizedUser.email,
      clientId: finalizedUser.clientId,
      role: finalizedUser.role,
      authProvider: finalizedUser.authProvider || "email",
    });

    return res.status(200).json({
      ok: true,
      token,
      user: publicUser(finalizedUser),
      client,
    });
  } catch (err: unknown) {
    console.error("[auth/login] Unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Sign-in failed. Please try again." });
  }
}

export async function requestPasswordResetOtpRoute(req: Request, res: Response) {
  try {
    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return res.status(400).json({ ok: false, error: "A valid email address is required" });
    }

    const [matchedUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${rawEmail}`)
      .limit(1);

    if (matchedUser) {
      const cooldownThreshold = new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000);
      const [recentOtp] = await db
        .select({ createdAt: emailVerificationOtps.createdAt })
        .from(emailVerificationOtps)
        .where(
          and(
            sql`lower(${emailVerificationOtps.email}) = ${rawEmail}`,
            eq(emailVerificationOtps.purpose, "password_reset"),
            gt(emailVerificationOtps.createdAt, cooldownThreshold),
          ),
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
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

      await invalidateActiveOtps(rawEmail, "password_reset");
      await db.insert(emailVerificationOtps).values({
        email: rawEmail,
        userId: matchedUser.id,
        otpHash: hashOtp(otp),
        purpose: "password_reset",
        expiresAt,
        attempts: 0,
      });
      await sendPasswordResetOtpEmail({ to: rawEmail, otp });
    }

    return res.status(200).json({
      ok: true,
      message: "If an account exists for this email, a password reset code has been sent.",
      expiryMinutes: OTP_EXPIRY_MINUTES,
    });
  } catch (err: unknown) {
    console.error("[auth/password-reset/request] Unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Could not send a password reset code. Please try again." });
  }
}

export async function verifyPasswordResetOtpRoute(req: Request, res: Response) {
  try {
    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const rawOtp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
    const rawPassword = typeof req.body?.password === "string" ? req.body.password : "";

    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      return res.status(400).json({ ok: false, error: "A valid email address is required" });
    }
    if (!/^\d{6}$/.test(rawOtp)) {
      return res.status(400).json({ ok: false, error: "A valid 6-digit verification code is required" });
    }
    if (rawPassword.length < 8) {
      return res.status(400).json({ ok: false, error: "Password must be at least 8 characters long" });
    }

    const [activeRecord] = await db
      .select()
      .from(emailVerificationOtps)
      .where(
        and(
          sql`lower(${emailVerificationOtps.email}) = ${rawEmail}`,
          eq(emailVerificationOtps.purpose, "password_reset"),
          isNull(emailVerificationOtps.consumedAt),
          gt(emailVerificationOtps.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(emailVerificationOtps.createdAt))
      .limit(1);

    if (!activeRecord) {
      return res.status(400).json({ ok: false, error: "Reset code has expired or is invalid. Please request a new code." });
    }
    if (activeRecord.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ ok: false, error: "Too many failed attempts. Please request a new reset code." });
    }

    if (!verifyOtpHash(rawOtp, activeRecord.otpHash)) {
      await db
        .update(emailVerificationOtps)
        .set({ attempts: activeRecord.attempts + 1 })
        .where(eq(emailVerificationOtps.id, activeRecord.id));
      const remaining = Math.max(0, MAX_OTP_ATTEMPTS - (activeRecord.attempts + 1));
      return res.status(400).json({
        ok: false,
        error: `Incorrect reset code. ${remaining > 0 ? `${remaining} attempts remaining.` : "Please request a new code."}`,
      });
    }

    await db
      .update(users)
      .set({ passwordHash: hashPassword(rawPassword), updatedAt: new Date() })
      .where(sql`lower(${users.email}) = ${rawEmail}`);

    await db
      .update(emailVerificationOtps)
      .set({ consumedAt: new Date(), attempts: activeRecord.attempts + 1 })
      .where(eq(emailVerificationOtps.id, activeRecord.id));

    return res.status(200).json({ ok: true, message: "Password updated successfully." });
  } catch (err: unknown) {
    console.error("[auth/password-reset/verify] Unexpected error:", err);
    return res.status(500).json({ ok: false, error: "Could not reset password. Please try again." });
  }
}

/**
 * POST /api/auth/sync
 *
 * Provisions the signed-in user's workspace.
 * Handles both:
 * - Supabase OAuth users (Google login): have req.supabaseUser, need workspace provisioning
 * - Custom JWT users (Email/Password or OTP): have req.user and req.clientId already, may already have workspace
 */
export async function syncAuthUserRoute(req: Request, res: Response) {
  try {
    // Case 1: Custom JWT user (Email/Password or OTP signup) - already has user + clientId
    if (req.user && req.clientId) {
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, req.clientId))
        .limit(1);

      if (!client) {
        return res.status(404).json({ ok: false, error: "Workspace not found" });
      }

      // Update last login
      await db
        .update(users)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, req.user.id));

      return res.status(200).json({
        ok: true,
        user: publicUser(req.user),
        client,
        requiresPhoneVerification: false,
      });
    }

    // Case 2: Supabase OAuth user (Google login) - needs workspace provisioning
    if (!req.supabaseUser) {
      return res.status(401).json({ ok: false, error: "Authenticated session is required" });
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
      requiresPhoneVerification: false,
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
    const client = req.user.clientId
      ? await enforceTrialExpiration(req.user.clientId)
      : null;

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
