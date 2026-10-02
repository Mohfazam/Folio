import { NextRequest, NextResponse } from "next/server";

const DEFAULT_CALLING_SERVICE =
  process.env.CALLING_SERVICE_URL ||
  process.env.NEXT_PUBLIC_CALLING_SERVICE_URL ||
  "https://folio-calling-production.up.railway.app";

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get("engineUrl");
  const baseUrl = (urlParam || DEFAULT_CALLING_SERVICE).replace(/\/$/, "");

  const start = Date.now();
  try {
    const [healthRes, activeRes] = await Promise.all([
      fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${baseUrl}/active-calls`, { signal: AbortSignal.timeout(5000) }),
    ]);

    const latencyMs = Date.now() - start;
    const health = healthRes.ok ? await healthRes.json() : null;
    const active = activeRes.ok ? await activeRes.json() : null;

    return NextResponse.json({
      ok: healthRes.ok,
      engineUrl: baseUrl,
      latencyMs,
      health,
      activeCalls: active?.activeCalls || [],
      activeCount: active?.count ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        engineUrl: baseUrl,
        latencyMs: Date.now() - start,
        error: err?.message || "Unreachable",
        activeCalls: [],
        activeCount: 0,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
