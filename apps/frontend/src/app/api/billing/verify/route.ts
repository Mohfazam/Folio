import { NextRequest, NextResponse } from "next/server";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";
import { verifyBillingPaymentRequestSchema } from "@/features/billing/schemas";
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
      { ok: false, error: "You must be signed in to verify a payment." },
      { status: 401 },
    );
  }

  const rawBody: unknown = await request.json().catch(() => null);
  const parsed = verifyBillingPaymentRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Missing required Razorpay verification fields." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${backendBaseUrl()}/api/billing/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
    const payload: unknown = await response.json().catch(() => null);
    const record =
      typeof payload === "object" && payload !== null && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : null;

    if (!response.ok || !record || record.ok === false) {
      return NextResponse.json(
        { ok: false, error: sanitizeUserError(record?.error, "Payment signature could not be verified.") },
        { status: response.status || 400 },
      );
    }

    return NextResponse.json({ ok: true, ...record }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/billing/verify] POST failed:", error);
    return NextResponse.json(
      { ok: false, error: sanitizeUserError(error instanceof Error ? error.message : null, "Unable to verify payment.") },
      { status: 502 },
    );
  }
}
