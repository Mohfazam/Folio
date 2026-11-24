import { sanitizeUserError } from "@/lib/utils/sanitize-error";
import {
  createBillingOrderRequestSchema,
  createBillingOrderResponseSchema,
  verifyBillingPaymentRequestSchema,
  verifyBillingPaymentResponseSchema,
} from "../schemas";
import type {
  BillingOrderRecord,
  BillingStatusResponse,
  CreateBillingOrderRequest,
  CreateBillingOrderResponse,
  VerifyBillingPaymentRequest,
  VerifyBillingPaymentResponse,
} from "../types";

export class BillingApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly isBackendUnconfigured = false,
  ) {
    super(message);
    this.name = "BillingApiError";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeOrder(value: unknown): BillingOrderRecord | null {
  const row = asRecord(value);
  if (!row || typeof row.orderId !== "string" || !row.orderId) return null;
  return {
    orderId: row.orderId,
    paymentId: typeof row.paymentId === "string" && row.paymentId ? row.paymentId : null,
    planId: typeof row.planId === "string" ? row.planId : "growth",
    planName: typeof row.planName === "string" ? row.planName : "Plan",
    amountInr: typeof row.amountInr === "number" ? row.amountInr : 0,
    creditsGranted: typeof row.creditsGranted === "number" ? row.creditsGranted : 0,
    method: typeof row.method === "string" && row.method ? row.method : null,
    status: typeof row.status === "string" ? row.status : "created",
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
  };
}

function isRouteNotImplemented(status: number, rawError: unknown): boolean {
  if (status === 404 || status === 501) return true;
  if (typeof rawError === "string" && /not found|cannot (get|post)/i.test(rawError)) {
    return true;
  }
  return false;
}

export async function fetchBillingStatus(): Promise<BillingStatusResponse> {
  const response = await fetch("/api/billing/status", { method: "GET", cache: "no-store" });
  const payload: unknown = await response.json().catch(() => null);
  const record = asRecord(payload);

  if (!response.ok || !record || record.ok === false) {
    const unconfigured = isRouteNotImplemented(response.status, record?.error);
    throw new BillingApiError(
      unconfigured
        ? "Online billing endpoints are not connected yet."
        : sanitizeUserError(record?.error, "Unable to load your billing & credit status right now."),
      response.status,
      unconfigured,
    );
  }

  const orders = (Array.isArray(record.orders) ? record.orders : [])
    .map(normalizeOrder)
    .filter((item): item is BillingOrderRecord => item !== null);

  return {
    ok: true,
    creditsBalance: typeof record.creditsBalance === "number" ? record.creditsBalance : 0,
    creditsAllowance: typeof record.creditsAllowance === "number" ? record.creditsAllowance : 0,
    creditsUsed: typeof record.creditsUsed === "number" ? record.creditsUsed : 0,
    currentPlanTier: typeof record.currentPlanTier === "string" ? record.currentPlanTier : "trial",
    status: typeof record.status === "string" ? record.status : "trialing",
    lastPurchasedPlanId: typeof record.lastPurchasedPlanId === "string" ? record.lastPurchasedPlanId : null,
    lastPurchasedAt: typeof record.lastPurchasedAt === "string" ? record.lastPurchasedAt : null,
    orders,
  };
}

export async function createRazorpayOrder(input: CreateBillingOrderRequest): Promise<CreateBillingOrderResponse> {
  const validatedInput = createBillingOrderRequestSchema.parse(input);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (validatedInput.idempotencyKey) {
    headers["Idempotency-Key"] = validatedInput.idempotencyKey;
  }

  const response = await fetch("/api/billing/order", {
    method: "POST",
    headers,
    body: JSON.stringify(validatedInput),
    cache: "no-store",
  });

  const payload: unknown = await response.json().catch(() => null);
  const record = asRecord(payload);

  if (!response.ok || !record || record.ok === false) {
    const unconfigured = isRouteNotImplemented(response.status, record?.error);
    throw new BillingApiError(
      unconfigured
        ? "Checkout is waiting for the backend payment endpoint (/api/billing/order) to go live."
        : sanitizeUserError(record?.error, "Could not initiate Razorpay checkout order. Please try again."),
      response.status,
      unconfigured,
    );
  }

  const parsed = createBillingOrderResponseSchema.safeParse(record);
  if (!parsed.success) {
    throw new BillingApiError("Payment order response was incomplete. Please try again.", 502);
  }
  return parsed.data;
}

export async function verifyRazorpayPayment(input: VerifyBillingPaymentRequest): Promise<VerifyBillingPaymentResponse> {
  const validatedInput = verifyBillingPaymentRequestSchema.parse(input);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (validatedInput.idempotencyKey) {
    headers["Idempotency-Key"] = validatedInput.idempotencyKey;
  }

  const response = await fetch("/api/billing/verify", {
    method: "POST",
    headers,
    body: JSON.stringify(validatedInput),
    cache: "no-store",
  });

  const payload: unknown = await response.json().catch(() => null);
  const record = asRecord(payload);

  if (!response.ok || !record || record.ok === false) {
    throw new BillingApiError(
      sanitizeUserError(record?.error, "Payment verification failed. Contact support with your payment ID."),
      response.status,
    );
  }

  const parsed = verifyBillingPaymentResponseSchema.safeParse(record);
  if (!parsed.success || !parsed.data.verified) {
    throw new BillingApiError("Payment could not be verified automatically.", 400);
  }
  return parsed.data;
}
