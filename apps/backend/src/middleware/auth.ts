import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import type { DecodedIdToken } from "firebase-admin/auth";
import { verifyFirebaseToken, adminAuth } from "../config/firebase.js";
import { db } from "../config/db.js";
import { users } from "@repo/db";

declare global {
  namespace Express {
    interface Request {
      user?: typeof users.$inferSelect;
      clientId?: string;
      firebaseUid?: string;
      firebaseToken?: DecodedIdToken;
    }
  }
}

function getBearerToken(req: Request): string | undefined {
  const authorization = req.get("authorization");
  const match = authorization?.match(/^Bearer ([^\s]+)$/i);
  return match?.[1];
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!adminAuth) {
    return res.status(503).json({ ok: false, error: "Authentication service is not configured" });
  }

  const idToken = getBearerToken(req);
  if (!idToken) {
    return res.status(401).json({ ok: false, error: "A valid Bearer token is required" });
  }

  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await verifyFirebaseToken(idToken);
  } catch (err: unknown) {
    console.warn("[middleware/auth] Firebase token verification failed:", err);
    return res.status(401).json({ ok: false, error: "Unauthorized: Invalid or expired token" });
  }

  req.firebaseUid = decodedToken.uid;
  req.firebaseToken = decodedToken;

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, decodedToken.uid))
      .limit(1);

    if (user) {
      req.user = user;
      req.clientId = user.clientId ?? undefined;
    }

    return next();
  } catch (err: unknown) {
    return next(err);
  }
}

export function requireWorkspace(req: Request, res: Response, next: NextFunction) {
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

  return next();
}

export function requireClientAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "client_admin" && req.user?.role !== "internal_admin") {
    return res.status(403).json({ ok: false, error: "Workspace administrator access is required" });
  }

  return next();
}

function matchesSecret(expected: string | undefined, actual: string | undefined): boolean {
  if (!expected || !actual) return false;

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export function requireWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.WEBHOOK_SECRET?.trim();
  if (!expected) {
    return res.status(503).json({ ok: false, error: "Webhook authentication is not configured" });
  }

  if (!matchesSecret(expected, req.get("x-webhook-secret")?.trim())) {
    return res.status(401).json({ ok: false, error: "Unauthorized webhook request" });
  }

  return next();
}

export function requireWorkerSecret(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.BACKEND_WORKER_SECRET?.trim();
  if (!expected) {
    return res.status(503).json({ ok: false, error: "Worker authentication is not configured" });
  }

  if (!matchesSecret(expected, getBearerToken(req))) {
    return res.status(401).json({ ok: false, error: "Unauthorized worker request" });
  }

  return next();
}
