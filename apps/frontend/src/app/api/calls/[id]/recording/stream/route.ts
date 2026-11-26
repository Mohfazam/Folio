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
  request: Request,
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
    const upstreamHeaders: Record<string, string> = {
      Authorization: `Bearer ${auth.accessToken}`,
    };

    const range = request.headers.get("range");
    if (range) {
      upstreamHeaders["range"] = range;
    }

    const backendUrl = `${backendBaseUrl()}/api/calls/${encodeURIComponent(id)}/recording/stream`;
    const response = await fetch(backendUrl, {
      headers: upstreamHeaders,
      cache: "no-store",
      redirect: "follow",
    });

    if (!response.ok) {
      return NextResponse.json(
        { ok: false, error: "Failed to load audio stream from voice provider" },
        { status: response.status },
      );
    }

    const headers = new Headers();
    const contentType = response.headers.get("content-type") || "audio/mpeg";
    const contentLength = response.headers.get("content-length");
    const contentRange = response.headers.get("content-range");
    const acceptRanges = response.headers.get("accept-ranges") || "bytes";
    const contentDisposition = response.headers.get("content-disposition");
    const etag = response.headers.get("etag");

    headers.set("Content-Type", contentType);
    headers.set("Accept-Ranges", acceptRanges);
    if (contentLength) headers.set("Content-Length", contentLength);
    if (contentRange) headers.set("Content-Range", contentRange);
    if (contentDisposition) headers.set("Content-Disposition", contentDisposition);
    if (etag) headers.set("ETag", etag);

    // Avoid aggressive no-store on range chunks so media players can buffer/seek smoothly
    headers.set(
      "Cache-Control",
      range ? "private, max-age=0, must-revalidate" : "private, no-cache, must-revalidate",
    );

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error("[api/calls/recording/stream] Proxy error:", error);
    return NextResponse.json({ ok: false, error: "Recording stream error" }, { status: 500 });
  }
}