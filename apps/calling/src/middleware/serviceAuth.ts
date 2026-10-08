import { timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export function requireCallingServiceAuth(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.CALLING_SERVICE_SECRET?.trim();
  const match = req.get("authorization")?.match(/^Bearer ([^\s]+)$/i);
  const provided = match?.[1];

  if (!expected) {
    return res.status(503).json({ ok: false, error: "Calling service authentication is not configured" });
  }

  if (!provided) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  if (expectedBytes.length !== providedBytes.length || !timingSafeEqual(expectedBytes, providedBytes)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  return next();
}
