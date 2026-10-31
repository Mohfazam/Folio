import type { Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { clients, users } from "@repo/db";

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
