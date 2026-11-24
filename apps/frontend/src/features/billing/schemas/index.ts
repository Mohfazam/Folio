import { z } from "zod";
import type { PurchasablePlanId } from "../types";

export const purchasablePlanIdSchema = z.enum(["growth", "pro", "scale"]);

export const billingPrefillDetailsSchema = z
  .object({
    name: z.string().trim().max(120).optional(),
    email: z.string().trim().max(160).optional(),
    contact: z.string().trim().max(32).optional(),
    companyName: z.string().trim().max(160).optional(),
    gstin: z.string().trim().max(32).optional(),
  })
  .optional();

export const createBillingOrderRequestSchema = z.object({
  planId: purchasablePlanIdSchema,
  idempotencyKey: z.string().min(8).max(128).optional(),
  billingDetails: billingPrefillDetailsSchema,
});

export const createBillingOrderResponseSchema = z.object({
  ok: z.boolean().optional(),
  orderId: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.string().min(1).default("INR"),
  keyId: z.string().min(1).optional(),
  planId: purchasablePlanIdSchema,
  planName: z.string().min(1),
  creditsToGrant: z.number().int().nonnegative(),
  prefill: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      contact: z.string().optional(),
    })
    .optional(),
});

export const verifyBillingPaymentRequestSchema = z.object({
  planId: purchasablePlanIdSchema,
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  idempotencyKey: z.string().min(8).max(128).optional(),
});

export const verifyBillingPaymentResponseSchema = z.object({
  ok: z.boolean().optional(),
  verified: z.boolean(),
  status: z.string().min(1),
  planId: z.string().min(1),
  planName: z.string().optional(),
  creditsGranted: z.number().int().nonnegative(),
  newCreditsBalance: z.number().int().nonnegative(),
  paymentId: z.string().min(1),
  orderId: z.string().min(1),
  method: z.string().nullable().optional(),
});

export function normalizePurchasablePlanId(value: string | null | undefined): PurchasablePlanId | null {
  if (!value) return null;
  const cleaned = value.trim().toLowerCase();
  const parsed = purchasablePlanIdSchema.safeParse(cleaned);
  return parsed.success ? parsed.data : null;
}
