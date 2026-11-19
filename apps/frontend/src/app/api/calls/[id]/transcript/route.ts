import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";

const MAX_TRANSCRIPT_TURNS = 2000;
const MAX_PAGE_SIZE = 20;

function backendBaseUrl() {
  return (
    process.env.BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:4000"
  ).replace(/\/+$/, "");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getDashboardAuthContext();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "You must be signed in" }, { status: 401 });
  }

  const { id } = await params;
  const search = new URL(request.url).searchParams;
  const offsetValue = search.get("offset") ?? "0";
  const limitValue = search.get("limit") ?? String(MAX_PAGE_SIZE);
  const offset = /^\d+$/.test(offsetValue) ? Number(offsetValue) : Number.NaN;
  const limit = /^\d+$/.test(limitValue) ? Number(limitValue) : Number.NaN;
  if (
    !id ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > MAX_TRANSCRIPT_TURNS ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MAX_PAGE_SIZE
  ) {
    return NextResponse.json({ ok: false, error: "Invalid transcript pagination parameters" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${backendBaseUrl()}/api/calls/${encodeURIComponent(id)}/transcript?offset=${offset}&limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${auth.accessToken}` },
        cache: "no-store",
      },
    );
    const payload: unknown = await response.json().catch(() => null);
    if (payload === null) {
      return NextResponse.json(
        { ok: false, error: "The workspace service returned an invalid transcript response." },
        { status: 502 },
      );
    }
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error("[api/calls/transcript] Proxy error:", error);
    return NextResponse.json(
      { ok: false, error: "Foolioo could not reach the workspace service. Please try again." },
      { status: 502 },
    );
  }
}
