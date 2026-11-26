import { NextRequest, NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";

function backendBaseUrl(): string {
  return (
    process.env.BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:4000"
  )
    .replace(/^http:\/\/localhost(?=[:/]|$)/i, "http://127.0.0.1")
    .replace(/\/+$/, "");
}

export async function GET(request: NextRequest) {
  const auth = await getDashboardAuthContext();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Sign in to view support tickets." }, { status: 401 });
  }

  try {
    const search = request.nextUrl.searchParams.toString();
    const url = `${backendBaseUrl()}/api/support/tickets${search ? `?${search}` : ""}`;
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload ?? { ok: false, error: "Invalid response" }, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[api/support/tickets] GET failed:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to load support tickets right now." },
      { status: 502 },
    );
  }
}
