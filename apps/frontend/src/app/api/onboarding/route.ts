import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function backendBaseUrl() {
  const value = process.env.BACKEND_API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:4000";
  return value.replace(/\/+$/, "");
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
  });

  const payload = await response.json().catch(() => ({ ok: false, error: "Invalid backend response" }));
  return { response, payload };
}

async function withAuthenticatedWorkspace(method: "GET" | "PUT", body?: unknown) {
  const supabase = await createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  const { data: { session } } = await supabase.auth.getSession();

  if (userError || !user || !session?.access_token) {
    return NextResponse.json({ ok: false, error: "You must be signed in" }, { status: 401 });
  }

  try {
    let result = await backendRequest(method, session.access_token, body);

    // A valid Supabase session can exist before its Neon user/workspace row.
    // Provision once, then retry the workspace-scoped onboarding request.
    if (result.response.status === 403) {
      const syncResponse = await fetch(`${backendBaseUrl()}/api/auth/sync`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
        cache: "no-store",
      });

      if (!syncResponse.ok) {
        const syncPayload = await syncResponse.json().catch(() => ({}));
        return NextResponse.json(
          { ok: false, error: syncPayload.error || "Could not prepare your workspace" },
          { status: syncResponse.status },
        );
      }

      result = await backendRequest(method, session.access_token, body);
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
