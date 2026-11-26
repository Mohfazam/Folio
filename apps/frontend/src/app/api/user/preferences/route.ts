import { NextRequest, NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";
import { sanitizeUserError } from "@/lib/utils/sanitize-error";

function getBackendBaseUrl(): string {
  return (
    process.env.BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:4000"
  ).replace(/\/+$/, "");
}

export async function PATCH(request: NextRequest) {
  const auth = await getDashboardAuthContext();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const response = await fetch(`${getBackendBaseUrl()}/api/user/preferences`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: sanitizeUserError(error instanceof Error ? error.message : null, "Failed to update preferences") },
      { status: 502 }
    );
  }
}
