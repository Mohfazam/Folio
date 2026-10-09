import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { env } from "../config/env.js";

/**
 * Standard JSON response handler when rate limit is exceeded.
 */
function limitHandler(_req: Request, res: Response) {
  res.status(429).json({
    ok: false,
    error: "Too many requests. Please slow down and try again later.",
  });
}

/**
 * Global rate limiter: protects the backend against general traffic spikes and brute force.
 * Automatically skips health check probes and testing environments.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 300, // 300 requests per 15 min per IP
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: limitHandler,
  skip: (req) => {
    if (env.isTest) return true;
    const path = req.path.toLowerCase();
    return path === "/health" || path === "/health/ready" || path.startsWith("/health/");
  },
});

/**
 * Strict rate limiter for authentication sync & phone binding endpoints.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 60, // 60 requests per 15 min per IP
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: limitHandler,
  skip: () => env.isTest,
});

/**
 * Upload & bulk operations limiter to protect memory and DB transactions from spam.
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30, // 30 uploads per 15 min per IP
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: limitHandler,
  skip: () => env.isTest,
});
