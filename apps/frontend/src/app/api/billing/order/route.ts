import { NextRequest, NextResponse } from "next/server";
import { createOrderRequestSchema } from "@/features/billing/schemas";
import { enforceDevTestPlanAllowed } from "@/features/billing/utils/dev-test-guard";
import { DEV_TEST_PLAN_AMOUNT_PAISE, DEV_TEST_PLAN_ID } from "@/features/billing/utils/dev-test-plan";

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

  const parsed = createOrderRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: JSON.stringify(parsed.error.issues) },
      { status: 400 },
    );
  }

  const { planId, idempotencyKey, billingDetails } = parsed.data;
  const blockedResponse = enforceDevTestPlanAllowed(planId, request.headers);
  if (blockedResponse) {
    return blockedResponse;
  }

  const backendBase = resolveBackendBaseUrl();
  if (!backendBase) {
    if (planId === DEV_TEST_PLAN_ID) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Backend billing endpoint is not configured yet for dev_test (expected 500 paise / INR 5 order creation on backend).",
          expectedAmountPaise: DEV_TEST_PLAN_AMOUNT_PAISE,
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "Backend billing order endpoint is not configured." },
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
  if (auth) forwardHeaders.authorization = auth;
  if (host) forwardHeaders["x-client-host"] = host;
  if (forwardedHost) forwardHeaders["x-forwarded-host"] = forwardedHost;

  const upstream = await fetch(`${backendBase}/api/billing/order`, {
    method: "POST",
    headers: forwardHeaders,
    body: JSON.stringify({
      planId,
      idempotencyKey,
      billingDetails,
      ...(planId === DEV_TEST_PLAN_ID ? { amountPaise: DEV_TEST_PLAN_AMOUNT_PAISE, currency: "INR" } : {}),
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
