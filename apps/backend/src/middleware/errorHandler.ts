import type { Request, Response, NextFunction } from "express";
import { MulterError } from "multer";
import { env } from "../config/env.js";

/**
 * Custom application operational error class.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 400, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 404 handler for any unmapped API endpoints.
 */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    ok: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Centralized error handling middleware.
 * Sanitizes internal details in production while providing informative messages in development.
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Handle JSON parse errors from body-parser / express.json()
  if (err instanceof SyntaxError && "status" in err && (err as any).status === 400) {
    return res.status(400).json({
      ok: false,
      error: "Malformed JSON payload provided in request body",
    });
  }

  // Handle payload too large errors
  if (err.type === "entity.too.large" || err.status === 413) {
    return res.status(413).json({
      ok: false,
      error: "Request entity too large",
    });
  }

  // Handle Multer upload errors
  if (err instanceof MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    return res.status(status).json({
      ok: false,
      error: err.message,
    });
  }

  // Handle CORS validation error
  if (err.message && err.message.startsWith("CORS error:")) {
    return res.status(403).json({
      ok: false,
      error: err.message,
    });
  }

  // Handle operational AppErrors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      ok: false,
      error: err.message,
    });
  }

  // Generic HTTP status code on error object
  const statusCode = typeof err.statusCode === "number" ? err.statusCode : typeof err.status === "number" ? err.status : 500;

  // Log unhandled server errors with context
  if (statusCode >= 500) {
    console.error(
      `[backend/error] 💥 Unhandled error on ${req.method} ${req.originalUrl}:`,
      err.stack || err
    );
  } else {
    console.warn(
      `[backend/warn] Client error on ${req.method} ${req.originalUrl} (${statusCode}):`,
      err.message || err
    );
  }

  if (res.headersSent) {
    return;
  }

  if (statusCode >= 500 && env.isProduction) {
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }

  return res.status(statusCode).json({
    ok: false,
    error: err.message || "An unexpected error occurred",
    ...(env.isProduction ? {} : { stack: err.stack }),
  });
}
