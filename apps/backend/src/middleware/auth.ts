import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import type { User } from "@supabase/supabase-js";
import { isSupabaseAuthConfigured, verifySupabaseToken } from "../config/supabase.js";
import { verifyAuthToken } from "../utils/tokens.js";
import { db, withDbRetry } from "../config/db.js";
import { env } from "../config/env.js";
import { users } from "@repo/db";
import { enforceTrialExpiration } from "../services/trialExpiration.js";

declare global {
  namespace Express {
    interface Request {
      user?: typeof users.$inferSelect;
      clientId?: string;
      supabaseUser?: User;
    }
  }
}

export function getBearerToken(req: Request): string | undefined {
  const authorization = req.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  return match?.[1];
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const idToken = getBearerToken(req);
  if (!idToken) {
    return res.status(401).json({ ok: false, error: "A valid Bearer token is required" });
  }

  // 1. Try verifying as an application session JWT (Email + Password / OTP auth)
  const appPayload = verifyAuthToken(idToken);
  if (appPayload) {
    try {
      const [user] = await withDbRetry(() =>
        db
          .select()
          .from(users)
          .where(eq(users.id, appPayload.userId))
          .limit(1),
      );

      if (!user) {
        return res.status(401).json({ ok: false, error: "Unauthorized: User not found" });
      }

      req.user = user;
      req.clientId = user.clientId ?? undefined;
      return next();
    } catch (err: unknown) {
      return next(err);
    }
  }

  // 2. Fall back to Supabase access token (Google OAuth identity)
  if (!isSupabaseAuthConfigured()) {
    return res.status(401).json({ ok: false, error: "Unauthorized: Invalid or expired token" });
  }

  let supabaseUser: User;
  try {
    supabaseUser = await verifySupabaseToken(idToken);
  } catch (err: unknown) {
    console.warn("[middleware/auth] Token verification failed:", err);
    return res.status(401).json({ ok: false, error: "Unauthorized: Invalid or expired token" });
  }

  req.supabaseUser = supabaseUser;

  try {
    const [user] = await withDbRetry(() =>
      db
        .select()
        .from(users)
        .where(eq(users.authUserId, supabaseUser.id))
        .limit(1),
    );

    if (user) {
      req.user = user;
      req.clientId = user.clientId ?? undefined;
    }

    return next();
  } catch (err: unknown) {
    return next(err);
  }
}

export async function requireWorkspace(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.clientId) {
    return res.status(403).json({ ok: false, error: "A provisioned workspace is required" });
  }

  const requestedClientId = req.query.clientId;
  if (typeof requestedClientId === "string" && requestedClientId !== req.clientId) {
    return res.status(403).json({ ok: false, error: "Workspace access denied" });
  }

  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    const bodyClientId = req.body.clientId;
    if (typeof bodyClientId === "string" && bodyClientId !== req.clientId) {
      return res.status(403).json({ ok: false, error: "Workspace access denied" });
    }
    req.body.clientId = req.clientId;
  }

  try {
    if (process.env.NODE_ENV !== "test") {
      await enforceTrialExpiration(req.clientId);
    }
    return next();
  } catch (err: unknown) {
    return next(err);
  }
}

function isFounderEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const raw = process.env.FOUNDER_ADMIN_EMAILS?.trim();
  if (!raw) return false;
  const allowedEmails = raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowedEmails.includes(email.trim().toLowerCase());
}

export function requireInternalAdmin(req: Request, res: Response, next: NextFunction) {
  const userEmail = req.user?.email ?? req.supabaseUser?.email;
  if (req.user?.role === "internal_admin" || isFounderEmail(userEmail)) {
    return next();
  }

  return res.status(403).json({ ok: false, error: "Founder / internal administrator access is required" });
}

export function requireClientAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "client_admin" && req.user?.role !== "internal_admin") {
    return res.status(403).json({ ok: false, error: "Workspace administrator access is required" });
  }

  return next();
}

export function matchesSecret(expected: string | undefined, actual: string | undefined): boolean {
  if (!expected || !actual) return false;

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export function requireWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const expected = env.webhookSecret || process.env.WEBHOOK_SECRET?.trim() || process.env.CALLING_WEBHOOK_SECRET?.trim();
  if (!expected) {
    return res.status(503).json({ ok: false, error: "Webhook authentication is not configured" });
  }

  if (!matchesSecret(expected, req.get("x-webhook-secret")?.trim())) {
    return res.status(401).json({ ok: false, error: "Unauthorized webhook request" });
  }

  return next();
}

export function requireWorkerSecret(req: Request, res: Response, next: NextFunction) {
  const expected = env.workerSecret || process.env.BACKEND_WORKER_SECRET?.trim();
  if (!expected) {
    return res.status(503).json({ ok: false, error: "Worker authentication is not configured" });
  }

  if (!matchesSecret(expected, getBearerToken(req))) {
    return res.status(401).json({ ok: false, error: "Unauthorized worker request" });
  }

  return next();
}
