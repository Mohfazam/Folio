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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeTranscriptItems(raw: unknown): Array<{
  speaker: "assistant" | "user";
  text: string;
  timestamp: string | null;
}> {
  if (!Array.isArray(raw)) return [];
  const items: Array<{ speaker: "assistant" | "user"; text: string; timestamp: string | null }> = [];
  for (const entry of raw) {
    if (!isRecord(entry)) continue;
    const speaker = entry.speaker === "assistant" || entry.speaker === "user" ? entry.speaker : null;
    const text = typeof entry.text === "string" ? entry.text : null;
    const timestamp =
      entry.timestamp === null || entry.timestamp === undefined
        ? null
        : typeof entry.timestamp === "string"
          ? entry.timestamp
          : null;
    if (speaker && text !== null) {
      items.push({ speaker, text, timestamp });
    }
  }
  return items;
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

    // Fallback: if the deployed backend does not yet expose /api/calls/:id/transcript (404 Route not found),
    // fetch the call record from GET /api/calls/:id and paginate its transcript array cleanly.
    if (response.status === 404) {
      const fallbackRes = await fetch(
        `${backendBaseUrl()}/api/calls/${encodeURIComponent(id)}`,
        {
          headers: { Authorization: `Bearer ${auth.accessToken}` },
          cache: "no-store",
        },
      );
      const fallbackPayload: unknown = await fallbackRes.json().catch(() => null);
      if (
        fallbackRes.ok &&
        isRecord(fallbackPayload) &&
        fallbackPayload.ok === true &&
        isRecord(fallbackPayload.call)
      ) {
        const allItems = normalizeTranscriptItems(fallbackPayload.call.transcript);
        const sliced = allItems.slice(offset, offset + limit);
        return NextResponse.json(
          {
            ok: true,
            transcript: sliced,
            total: allItems.length,
            offset,
            limit,
          },
          { status: 200 },
        );
      }

      if (fallbackRes.status === 404) {
        return NextResponse.json(
          { ok: false, error: "Transcript is not available for this call." },
          { status: 404 },
        );
      }
    }

    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      console.error("[api/calls/transcript] Upstream error:", response.status, payload);
      return NextResponse.json(
        { ok: false, error: "Transcript is currently unavailable. Please try again shortly." },
        { status: response.status >= 400 && response.status < 500 ? response.status : 502 },
      );
    }

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("[api/calls/transcript] Proxy error:", error);
    return NextResponse.json(
      { ok: false, error: "Unable to load the transcript right now. Please try again." },
      { status: 502 },
    );
  }
}
