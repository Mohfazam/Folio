import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";
import { sanitizeUserError } from "@/lib/utils/sanitize-error";

function getBackendBaseUrl(): string {
  return (
    process.env.BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:4000"
  ).replace(/\/+$/, "");
}

export async function DELETE() {
  const auth = await getDashboardAuthContext();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(`${getBackendBaseUrl()}/api/user/avatar`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        Accept: "application/json"
      }
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: sanitizeUserError(error instanceof Error ? error.message : null, "Failed to remove avatar") },
      { status: 502 }
    );
  }
}
