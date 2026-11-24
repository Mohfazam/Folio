import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";
import { sanitizeUserError } from "@/lib/utils/sanitize-error";

function backendBaseUrl(): string {
  return (
    process.env.BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:4000"
  ).replace(/\/+$/, "");
}

export async function GET() {
  const auth = await getDashboardAuthContext();
  if (!auth) {
    return NextResponse.json(
      { ok: false, error: "Sign in to view billing and credits." },
      { status: 401 },
    );
  }

  try {
    const response = await fetch(`${backendBaseUrl()}/api/billing/status`, {
      method: "GET",
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      cache: "no-store",
    });
    const payload: unknown = await response.json().catch(() => null);
    const record =
      typeof payload === "object" && payload !== null && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : null;

    if (!response.ok || !record || record.ok === false) {
      return NextResponse.json(
        { ok: false, error: sanitizeUserError(record?.error, "Billing status is unavailable right now.") },
        { status: response.status || 502 },
      );
    }
    return NextResponse.json({ ok: true, ...record }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/billing/status] GET failed:", error);
    return NextResponse.json(
      { ok: false, error: sanitizeUserError(error instanceof Error ? error.message : null, "Unable to reach billing service.") },
      { status: 502 },
    );
  }
}
