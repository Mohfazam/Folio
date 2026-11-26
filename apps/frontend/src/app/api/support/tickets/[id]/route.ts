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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await getDashboardAuthContext();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "Sign in to update support tickets." }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const response = await fetch(`${backendBaseUrl()}/api/support/tickets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload ?? { ok: false, error: "Invalid response" }, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("[api/support/tickets/:id] PATCH failed:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to update support ticket right now." },
      { status: 502 },
    );
  }
}
