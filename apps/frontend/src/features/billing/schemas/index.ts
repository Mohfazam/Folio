import { z } from "zod";

export const STANDARD_PURCHASABLE_PLAN_IDS = ["growth", "pro", "scale"] as const;
export const DEV_TEST_PLAN_ID = "dev_test" as const;
export const ALL_PURCHASABLE_PLAN_IDS = [
  ...STANDARD_PURCHASABLE_PLAN_IDS,
  DEV_TEST_PLAN_ID,
] as const;

export const standardPurchasablePlanSchema = z.enum(STANDARD_PURCHASABLE_PLAN_IDS);
export const purchasablePlanSchema = z.enum(ALL_PURCHASABLE_PLAN_IDS);

export const createBillingOrderRequestSchema = z.object({
  planId: purchasablePlanSchema,
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
  billingDetails: z
    .object({
      name: z.string().trim().max(160).optional(),
      email: z.string().trim().max(200).optional(),
      contact: z.string().trim().max(40).optional(),
      companyName: z.string().trim().max(200).optional(),
      gstin: z.string().trim().max(30).optional(),
    })
    .optional(),
});

export const createOrderRequestSchema = createBillingOrderRequestSchema;

export const createBillingOrderResponseSchema = z.object({
  orderId: z.string().trim().min(1),
  amount: z.number().int().positive(),
  currency: z.string().trim().min(1).default("INR"),
  keyId: z.string().trim().optional(),
  prefill: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
      contact: z.string().optional(),
    })
    .optional(),
});

export const verifyBillingPaymentRequestSchema = z.object({
  planId: purchasablePlanSchema,
  razorpay_order_id: z.string().trim().min(1),
  razorpay_payment_id: z.string().trim().min(1),
  razorpay_signature: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
});

export const verifyPaymentRequestSchema = verifyBillingPaymentRequestSchema;

export const verifyBillingPaymentResponseSchema = z.object({
  ok: z.boolean().optional().default(true),
  verified: z.boolean().optional().default(true),
  status: z.string().trim().min(1),
  planId: z.string().trim().min(1),
  planName: z.string().trim().min(1),
  creditsGranted: z.number().nonnegative(),
  newCreditsBalance: z.number().nonnegative().nullable().optional(),
  paymentId: z.string().trim().min(1),
  orderId: z.string().trim().min(1),
  method: z.string().nullable().optional().default(null),
});

export function normalizeStandardPlanId(
  value: string | null | undefined,
): "growth" | "pro" | "scale" | null {
  if (!value) return null;
  const parsed = standardPurchasablePlanSchema.safeParse(value.trim().toLowerCase());
  return parsed.success ? parsed.data : null;
}

export function normalizePurchasablePlanId(
  value: string | null | undefined,
): "growth" | "pro" | "scale" | "dev_test" | null {
  if (!value) return null;
  const parsed = purchasablePlanSchema.safeParse(value.trim().toLowerCase());
  return parsed.success ? parsed.data : null;
}
