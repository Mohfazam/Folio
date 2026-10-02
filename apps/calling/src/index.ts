// In Node 22+, globalThis.WebSocket exists but ignores custom headers in its constructor.
// The sarvamai SDK checks `if (typeof WebSocket !== "undefined")`, selecting Node's built-in
// WebSocket which drops the `Api-Subscription-Key` header.
// Deleting it forces the SDK to fall back to the `ws` package in Node runtime.
delete (globalThis as any).WebSocket;

import { startServer } from "./sarwar.js";

// ── Global error handlers to prevent silent crashes ─────────────────
process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] Unhandled Promise Rejection:", reason);
  // Don't crash — the calling service should stay up for other active calls
});

process.on("uncaughtException", (error) => {
  console.error("[FATAL] Uncaught Exception:", error);
  // Log but don't crash for recoverable errors
  // For truly unrecoverable errors, the process will crash naturally
});

startServer();