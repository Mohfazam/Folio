import { NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";

function backendBaseUrl() {
  const raw =
    process.env.BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:4000";
  return raw
    .replace(/^http:\/\/localhost(?=[:/]|$)/i, "http://127.0.0.1")
    .replace(/\/+$/, "");
}

async function backendRequest(method: "GET" | "PUT", accessToken: string, body?: unknown) {
  const response = await fetch(`${backendBaseUrl()}/api/onboarding`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  const payload = await response.json().catch(() => ({ ok: false, error: "Invalid backend response" }));
  return { response, payload };
}

async function withAuthenticatedWorkspace(method: "GET" | "PUT", body?: unknown) {
  const auth = await getDashboardAuthContext();
  if (!auth) {
    return NextResponse.json({ ok: false, error: "You must be signed in" }, { status: 401 });
  }

  try {
    let result = await backendRequest(method, auth.accessToken, body);

    // A valid Supabase OAuth session can exist before its Neon user/workspace row.
    // Provision once, then retry the workspace-scoped onboarding request.
    if (result.response.status === 403 && auth.supabase) {
      const syncResponse = await fetch(`${backendBaseUrl()}/api/auth/sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });

      if (!syncResponse.ok) {
        const syncPayload = await syncResponse.json().catch(() => ({}));
        return NextResponse.json(
          { ok: false, error: syncPayload.error || "Could not prepare your workspace" },
          { status: syncResponse.status },
        );
      }

      result = await backendRequest(method, auth.accessToken, body);
    }

    return NextResponse.json(result.payload, { status: result.response.status });
  } catch (error) {
    console.error("[api/onboarding] Proxy error:", error);
    return NextResponse.json(
      { ok: false, error: "Foolioo could not reach the workspace service. Please try again." },
      { status: 502 },
    );
  }
}

export async function GET() {
  return withAuthenticatedWorkspace("GET");
}

export async function PUT(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Request body must be valid JSON" }, { status: 400 });
  }
  return withAuthenticatedWorkspace("PUT", body);
}
