import { NextRequest, NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";
import { createBillingOrderRequestSchema } from "@/features/billing/schemas";
import { sanitizeUserError } from "@/lib/utils/sanitize-error";

function backendBaseUrl(): string {
  return (
    process.env.BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:4000"
  ).replace(/\/+$/, "");
}

export async function POST(request: NextRequest) {
  const auth = await getDashboardAuthContext();
  if (!auth) {
    return NextResponse.json(
      { ok: false, error: "You must be signed in to make a payment." },
      { status: 401 },
    );
  }

  const rawBody: unknown = await request.json().catch(() => null);
  const parsed = createBillingOrderRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid plan selected for payment." }, { status: 400 });
  }

  try {
    const response = await fetch(`${backendBaseUrl()}/api/billing/order`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ planId: parsed.data.planId }),
      cache: "no-store",
    });
    const payload: unknown = await response.json().catch(() => null);
    const record =
      typeof payload === "object" && payload !== null && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : null;

    if (!response.ok || !record || record.ok === false) {
      return NextResponse.json(
        { ok: false, error: sanitizeUserError(record?.error, "Unable to create payment order right now.") },
        { status: response.status || 502 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        ...record,
        keyId:
          typeof record.keyId === "string" && record.keyId.trim()
            ? record.keyId.trim()
            : process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || undefined,
      },
      { status: response.status, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[api/billing/order] POST failed:", error);
    return NextResponse.json(
      { ok: false, error: sanitizeUserError(error instanceof Error ? error.message : null, "Unable to reach payment service.") },
      { status: 502 },
    );
  }
}
