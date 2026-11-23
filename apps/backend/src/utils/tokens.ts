import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AppAuthPayload {
  userId: string;
  email: string | null;
  clientId?: string | null;
  role: string;
  authProvider: string;
}

/**
 * Signs an application session JWT valid for 7 days.
 */
export function signAuthToken(payload: AppAuthPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: "7d" });
}

/**
 * Verifies an application session JWT and returns the decoded payload, or null if invalid/expired.
 */
export function verifyAuthToken(token: string): AppAuthPayload | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    if (typeof decoded === "object" && decoded !== null && "userId" in decoded) {
      return decoded as AppAuthPayload;
    }
    return null;
  } catch {
    return null;
  }
}
