import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { clients, users } from "@repo/db";

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
  const token = req.firebaseToken!;
  const phoneNumber = typeof token.phone_number === "string" ? token.phone_number : null;

  return {
    firebaseUid: token.uid,
    email: typeof token.email === "string" ? token.email : null,
    phoneNumber,
    phoneVerified: phoneNumber !== null,
    displayName: typeof token.name === "string" ? token.name : null,
    avatarUrl: typeof token.picture === "string" ? token.picture : null,
    authProvider:
      typeof token.firebase?.sign_in_provider === "string"
        ? token.firebase.sign_in_provider
        : "firebase",
  };
}

/**
 * POST /api/auth/sync
 *
 * Provisions the signed-in Firebase identity and its initial workspace.
 * Profile identity fields are always sourced from verified token claims.
 */
export async function syncAuthUserRoute(req: Request, res: Response) {
  try {
    if (!req.firebaseToken) {
      return res.status(401).json({ ok: false, error: "Verified Firebase identity is required" });
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
      .where(eq(users.firebaseUid, profile.firebaseUid))
      .limit(1);

    if (!existingByUid && profile.email) {
      const [existingByEmail] = await db
        .select({ id: users.id, firebaseUid: users.firebaseUid })
        .from(users)
        .where(eq(users.email, profile.email))
        .limit(1);

      if (existingByEmail && existingByEmail.firebaseUid !== profile.firebaseUid) {
        return res.status(409).json({
          ok: false,
          error: "This email is already associated with another sign-in identity",
        });
      }
    }

    const result = await db.transaction(async (tx) => {
      let clientId = existingByUid?.clientId ?? null;

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

      const [user] = existingByUid
        ? await tx
            .update(users)
            .set({
              clientId,
              email: profile.email ?? existingByUid.email,
              phoneNumber: profile.phoneNumber ?? existingByUid.phoneNumber,
              phoneVerified: profile.phoneVerified || existingByUid.phoneVerified,
              emailVerified: Boolean(req.firebaseToken?.email_verified),
              displayName: profile.displayName ?? existingByUid.displayName,
              avatarUrl: profile.avatarUrl ?? existingByUid.avatarUrl,
              authProvider: profile.authProvider,
              lastLoginAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(users.id, existingByUid.id))
            .returning()
        : await tx
            .insert(users)
            .values({
              firebaseUid: profile.firebaseUid,
              clientId,
              email: profile.email,
              phoneNumber: profile.phoneNumber,
              phoneVerified: profile.phoneVerified,
              emailVerified: Boolean(req.firebaseToken?.email_verified),
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
 * Store only a phone number asserted by Firebase's verified token claims.
 */
export async function updateAuthPhoneRoute(req: Request, res: Response) {
  const profile = req.firebaseToken ? readProfile(req) : undefined;
  if (!profile?.phoneNumber || !req.user) {
    return res.status(403).json({
      ok: false,
      error: "A verified Firebase phone sign-in and an existing user profile are required",
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
