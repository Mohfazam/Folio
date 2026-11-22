const SENSITIVE_ERROR_PATTERN =
  /Failed query:|\bselect\b.+\bfrom\b|password_hash|auth_user_id|\bparams:\s*|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EPIPE|fetch failed|socket hang up|WebSocket|pg_|postgres/i;

/**
 * Strips raw SQL queries, database column names, and low-level socket/network
 * internals before surfacing any error message in the frontend UI.
 */
export function sanitizeUserError(
  message: unknown,
  fallback = "Something went wrong while loading this data. Please try again.",
): string {
  if (typeof message !== "string") return fallback;
  const trimmed = message.trim();
  if (!trimmed) return fallback;
  if (SENSITIVE_ERROR_PATTERN.test(trimmed)) return fallback;
  return trimmed.length > 220 ? fallback : trimmed;
}
