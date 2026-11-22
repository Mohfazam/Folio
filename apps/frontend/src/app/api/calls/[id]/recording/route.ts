import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";

function backendBaseUrl() {
  return (
    process.env.BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:4000"
  ).replace(/\/+$/, "");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getDashboardAuthContext();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "You must be signed in" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: "Call ID is required" }, { status: 400 });
  }

  try {
    const backendUrl = `${backendBaseUrl()}/api/calls/${encodeURIComponent(id)}/recording`;
    const response = await fetch(backendUrl, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
      },
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error("[api/calls/recording] Metadata error:", error);
    return NextResponse.json({ ok: false, error: "Failed to fetch recording metadata" }, { status: 500 });
  }
}
