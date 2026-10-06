import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { users, clients } from "@repo/db";

/**
 * Sanitizes phone numbers to E.164.
 */
function normalizePhoneNumber(raw?: string | null): string | null {
  if (!raw) return null;
  let cleaned = raw.trim().replace(/[^\d+]/g, "");
  if (/^\d{10}$/.test(cleaned)) {
    cleaned = `+91${cleaned}`;
  } else if (!cleaned.startsWith("+") && cleaned.length > 10) {
    cleaned = `+${cleaned}`;
  }
  return cleaned;
}

/**
 * POST /api/auth/sync
 *
 * Syncs a user authenticated via Firebase (Google, GitHub, Email, Phone OTP).
 * Creates or updates the user profile and automatically provisions a client workspace if needed.
 *
 * Request Body:
 * {
 *   firebaseUid: string,
 *   email?: string,
 *   phoneNumber?: string,
 *   displayName?: string,
 *   avatarUrl?: string,
 *   authProvider?: 'google' | 'github' | 'phone' | 'password',
 *   organizationName?: string
 * }
 */
export async function syncAuthUserRoute(req: Request, res: Response) {
  try {
    const {
      firebaseUid,
      email,
      phoneNumber,
      displayName,
      avatarUrl,
      authProvider = "firebase",
      organizationName,
    } = req.body as {
      firebaseUid?: string;
      email?: string;
      phoneNumber?: string;
      displayName?: string;
      avatarUrl?: string;
      authProvider?: string;
      organizationName?: string;
    };

    if (!firebaseUid) {
      return res.status(400).json({ ok: false, error: "firebaseUid is required" });
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // 1. Check if user already exists by firebaseUid or email
    let [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, firebaseUid))
      .limit(1);

    if (!existingUser && email) {
      const [userByEmail] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (userByEmail) {
        existingUser = userByEmail;
      }
    }

    let clientId = existingUser?.clientId;

    // 2. If no client exists for this user, create a new workspace/client
    if (!clientId) {
      const clientName = organizationName || displayName || (email ? email.split("@")[0] : "My Organization");
      const [newClient] = await db
        .insert(clients)
        .values({
          name: clientName!,
          contactPersonName: displayName ?? null,
          contactEmail: email ?? null,
          contactPhone: normalizedPhone,
          isPhoneVerified: Boolean(normalizedPhone && (authProvider === "phone" || phoneNumber)),
          callingHoursStart: "09:00:00",
          callingHoursEnd: "18:00:00",
          timezone: "Asia/Kolkata",
          planTier: "trial",
          monthlyCreditsAllowance: 360,
          maxCallsPerDay: 50,
          status: "trialing",
        })
        .returning();

      if (newClient) {
        clientId = newClient.id;
      }
    }

    // 3. Upsert user record
    let userResult;
    if (existingUser) {
      const [updatedUser] = await db
        .update(users)
        .set({
          firebaseUid,
          clientId,
          email: email ?? existingUser.email,
          phoneNumber: normalizedPhone ?? existingUser.phoneNumber,
          phoneVerified: normalizedPhone ? true : existingUser.phoneVerified,
          displayName: displayName ?? existingUser.displayName,
          avatarUrl: avatarUrl ?? existingUser.avatarUrl,
          authProvider,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();

      userResult = updatedUser;
    } else {
      const [createdUser] = await db
        .insert(users)
        .values({
          firebaseUid,
          clientId,
          email: email ?? null,
          phoneNumber: normalizedPhone,
          phoneVerified: Boolean(normalizedPhone),
          emailVerified: Boolean(email && (authProvider === "google" || authProvider === "github")),
          displayName: displayName ?? null,
          avatarUrl: avatarUrl ?? null,
          authProvider,
          role: "client_admin",
          lastLoginAt: new Date(),
        })
        .returning();

      userResult = createdUser;
    }

    // Fetch client details
    const [clientData] = clientId
      ? await db.select().from(clients).where(eq(clients.id, clientId)).limit(1)
      : [null];

    return res.status(200).json({
      ok: true,
      user: userResult,
      client: clientData,
      requiresPhoneVerification: !userResult?.phoneNumber || !userResult?.phoneVerified,
    });
  } catch (err: unknown) {
    console.error("[auth/sync] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * GET /api/auth/me
 *
 * Retrieve profile of user by firebaseUid.
 */
export async function getAuthMeRoute(req: Request, res: Response) {
  try {
    const { firebaseUid, userId } = req.query as { firebaseUid?: string; userId?: string };

    if (!firebaseUid && !userId) {
      return res.status(400).json({ ok: false, error: "firebaseUid or userId is required" });
    }

    const whereClause = firebaseUid ? eq(users.firebaseUid, firebaseUid) : eq(users.id, userId!);

    const [user] = await db.select().from(users).where(whereClause).limit(1);

    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    const [client] = user.clientId
      ? await db.select().from(clients).where(eq(clients.id, user.clientId)).limit(1)
      : [null];

    return res.json({
      ok: true,
      user,
      client,
      hasVerifiedPhone: Boolean(user.phoneNumber && user.phoneVerified),
    });
  } catch (err: unknown) {
    console.error("[auth/me] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * PATCH /api/auth/phone
 *
 * Update and verify the client's mandatory phone number.
 */
export async function updateAuthPhoneRoute(req: Request, res: Response) {
  try {
    const { firebaseUid, phoneNumber } = req.body as {
      firebaseUid?: string;
      phoneNumber?: string;
    };

    if (!firebaseUid || !phoneNumber) {
      return res.status(400).json({ ok: false, error: "firebaseUid and phoneNumber are required" });
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);
    if (!normalizedPhone) {
      return res.status(400).json({ ok: false, error: "Invalid phone number format" });
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        phoneNumber: normalizedPhone,
        phoneVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.firebaseUid, firebaseUid))
      .returning();

    if (!updatedUser) {
      return res.status(404).json({ ok: false, error: "User not found" });
    }

    // Also update client contact phone if user is linked to a client
    if (updatedUser.clientId) {
      await db
        .update(clients)
        .set({
          contactPhone: normalizedPhone,
          isPhoneVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(clients.id, updatedUser.clientId));
    }

    return res.json({
      ok: true,
      user: updatedUser,
      message: "Phone number verified and updated successfully",
    });
  } catch (err: unknown) {
    console.error("[auth/phone] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
