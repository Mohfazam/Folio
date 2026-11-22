import { sanitizeUserError } from "@/lib/utils/sanitize-error";

export class DashboardApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DashboardApiError";
  }
}

/**
 * Fetches a dashboard GET endpoint through the Next.js BFF proxy route so
 * cookies/auth stay server-side with zero CORS issues.
 */
export async function fetchDashboardApi<T extends Record<string, unknown>>(
  path: string,
  fallbackError = "Unable to load workspace data right now. Please try again.",
): Promise<T> {
  const normalized = path.replace(/^\/+/, "").replace(/^api\//, "");
  const response = await fetch(`/api/dashboard/proxy/${normalized}`, {
    method: "GET",
    cache: "no-store",
  });

  const payload: unknown = await response.json().catch(() => null);
  const record =
    typeof payload === "object" && payload !== null && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;

  if (!response.ok || !record || record.ok === false) {
    throw new DashboardApiError(
      sanitizeUserError(record?.error, fallbackError),
      response.status,
    );
  }

  return record as T;
}
