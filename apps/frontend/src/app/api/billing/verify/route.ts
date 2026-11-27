import { NextRequest, NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";
import { verifyPaymentRequestSchema } from "@/features/billing/schemas";
import { enforceDevTestPlanAllowed } from "@/features/billing/utils/dev-test-guard";

function resolveBackendBaseUrl(): string | null {
  const raw =
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  return trimmed ? trimmed : null;
}

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const parsed = verifyPaymentRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: JSON.stringify(parsed.error.issues) },
      { status: 400 },
    );
  }

  const { planId, razorpay_order_id, razorpay_subscription_id, razorpay_payment_id, razorpay_signature, idempotencyKey } =
    parsed.data;
  const blockedResponse = enforceDevTestPlanAllowed(planId, request.headers);
  if (blockedResponse) {
    return blockedResponse;
  }

  const backendBase = resolveBackendBaseUrl();
  if (!backendBase) {
    return NextResponse.json(
      { ok: false, error: "Backend billing verify endpoint is not configured." },
      { status: 503 },
    );
  }

  const forwardHeaders: Record<string, string> = {
    "content-type": "application/json",
  };
  const cookie = request.headers.get("cookie");
  const auth = request.headers.get("authorization");
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (cookie) forwardHeaders.cookie = cookie;
  if (host) forwardHeaders["x-client-host"] = host;
  if (forwardedHost) forwardHeaders["x-forwarded-host"] = forwardedHost;

  if (auth) {
    forwardHeaders.authorization = auth;
  } else {
    const authContext = await getDashboardAuthContext();
    if (!authContext) {
      return NextResponse.json(
        { ok: false, error: "Please sign in to verify payment." },
        { status: 401 },
      );
    }
    forwardHeaders.authorization = `Bearer ${authContext.accessToken}`;
  }

  const upstream = await fetch(`${backendBase}/api/billing/verify`, {
    method: "POST",
    headers: forwardHeaders,
    body: JSON.stringify({
      planId,
      razorpay_order_id,
      razorpay_subscription_id,
      razorpay_payment_id,
      razorpay_signature,
      idempotencyKey,
    }),
    cache: "no-store",
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") || "application/json",
    },
  });
}
