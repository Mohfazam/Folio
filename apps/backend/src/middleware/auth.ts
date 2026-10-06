import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { verifyFirebaseToken, adminAuth } from "../config/firebase.js";
import { db } from "../config/db.js";
import { users } from "@repo/db";

// Extend Express Request interface to include authenticated user and client context
declare global {
  namespace Express {
    interface Request {
      user?: typeof users.$inferSelect;
      clientId?: string;
      firebaseUid?: string;
    }
  }
}

/**
 * Authentication Middleware:
 * Extracts Bearer token, verifies via Firebase Admin SDK, and loads user context from DB.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ ok: false, error: "Unauthorized: Missing or invalid Authorization header" });
    }

    const idToken = authHeader.split("Bearer ")[1]?.trim();
    if (!idToken) {
      return res.status(401).json({ ok: false, error: "Unauthorized: Empty Bearer token" });
    }

    // If Firebase Admin is configured, verify token
    if (adminAuth) {
      const decodedToken = await verifyFirebaseToken(idToken);
      req.firebaseUid = decodedToken.uid;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.firebaseUid, decodedToken.uid))
        .limit(1);

      if (user) {
        req.user = user;
        req.clientId = user.clientId ?? undefined;
      }
    }

    return next();
  } catch (err: unknown) {
    console.error("[middleware/auth] Token verification failed:", err);
    return res.status(401).json({ ok: false, error: "Unauthorized: Invalid or expired token" });
  }
}
