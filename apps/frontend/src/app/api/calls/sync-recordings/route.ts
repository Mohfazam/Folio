import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";

function backendBaseUrl() {
  return (
    process.env.BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:4000"
  ).replace(/\/+$/, "");
}

export async function POST() {
  const auth = await getDashboardAuthContext();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "You must be signed in" }, { status: 401 });
  }

  try {
    const backendUrl = `${backendBaseUrl()}/api/calls/sync-recordings`;
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error("[api/calls/sync-recordings] Sync proxy error:", error);
    return NextResponse.json(
      { ok: false, error: "Failed to communicate with recording sync service" },
      { status: 500 },
    );
  }
}
