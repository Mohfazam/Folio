export type PurchasablePlanId = "growth" | "pro";
export type AllPlanId = "growth" | "pro" | "scale";

export interface OneTimePlanDefinition {
  id: PurchasablePlanId;
  name: string;
  badge?: string;
  originalPriceInr?: number;
  priceInr: number;
  amountPaise: number;
  credits: number;
  estimateLabel: string;
  roughlyCalls: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}

export interface BillingOrderRecord {
  orderId: string;
  paymentId: string | null;
  planId: string;
  planName: string;
  amountInr: number;
  creditsGranted: number;
  method?: string | null;
  status: "created" | "paid" | "failed" | "pending" | string;
  createdAt: string;
}

export interface BillingStatusResponse {
  ok?: boolean;
  creditsBalance: number;
  creditsAllowance: number;
  creditsUsed: number;
  currentPlanTier: string;
  status: string;
  lastPurchasedPlanId: string | null;
  lastPurchasedAt: string | null;
  orders: BillingOrderRecord[];
}

export interface CreateBillingOrderRequest {
  planId: PurchasablePlanId;
  idempotencyKey?: string;
}

export interface CreateBillingOrderResponse {
  ok?: boolean;
  orderId: string;
  amount: number;
  currency: "INR" | string;
  keyId?: string;
  planId: PurchasablePlanId;
  planName: string;
  creditsToGrant: number;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
}

export interface VerifyBillingPaymentRequest {
  planId: PurchasablePlanId;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  idempotencyKey?: string;
}

export interface VerifyBillingPaymentResponse {
  ok?: boolean;
  verified: boolean;
  status: "paid" | "pending" | string;
  planId: string;
  planName?: string;
  creditsGranted: number;
  newCreditsBalance: number;
  paymentId: string;
  orderId: string;
  method?: string | null;
}

export interface RazorpaySuccessPayload {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailureResponse {
  error?: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: {
      order_id?: string;
      payment_id?: string;
    };
  };
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id: string;
  handler: (response: RazorpaySuccessPayload) => void | Promise<void>;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    confirm_close?: boolean;
  };
}

export interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", handler: (response: RazorpayFailureResponse) => void) => void;
  close?: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}
