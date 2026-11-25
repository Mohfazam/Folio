export type StandardPurchasablePlanId = "growth" | "pro" | "scale";
export type LocalDevTestPlanId = "dev_test";
export type PurchasablePlanId = StandardPurchasablePlanId | LocalDevTestPlanId;

export type OneTimePlanDefinition = {
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
  highlighted: boolean;
};

export type BillingOrderRecord = {
  orderId: string;
  paymentId: string | null;
  planId: string;
  planName: string;
  amountInr: number;
  creditsGranted: number;
  status: string;
  method: string | null;
  createdAt: string | null;
};

export type BillingStatusResponse = {
  ok: boolean;
  currentPlanTier?: string | null;
  creditsBalance?: number | null;
  creditsAllowance?: number | null;
  creditsUsed?: number | null;
  status?: string;
  lastPurchasedPlanId?: string | null;
  lastPurchasedAt?: string | null;
  orders?: BillingOrderRecord[];
};

export type CreateBillingOrderRequest = {
  planId: PurchasablePlanId;
  idempotencyKey?: string;
  billingDetails?: {
    name?: string;
    email?: string;
    contact?: string;
    companyName?: string;
    gstin?: string;
  };
};

export type CreateBillingOrderResponse = {
  orderId: string;
  amount: number;
  currency: string;
  keyId?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
};

export type VerifyBillingPaymentRequest = {
  planId: PurchasablePlanId;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  idempotencyKey?: string;
};

export type VerifyBillingPaymentResponse = {
  ok: boolean;
  verified: boolean;
  status: string;
  planId: string;
  planName: string;
  creditsGranted: number;
  newCreditsBalance: number | null;
  paymentId: string;
  orderId: string;
  method: string | null;
};

export type RazorpaySuccessPayload = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type RazorpayFailureResponse = {
  error?: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
  };
};

export type RazorpayCheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: { color: string };
  modal?: {
    escape?: boolean;
    confirm_close?: boolean;
    ondismiss?: () => void;
  };
  handler: (response: RazorpaySuccessPayload) => void | Promise<void>;
};

export type RazorpayCheckoutInstance = {
  on: (event: "payment.failed", handler: (failure: RazorpayFailureResponse) => void) => void;
  open: () => void;
  close: () => void;
};

export type RazorpayCheckoutConstructor = new (
  options: RazorpayCheckoutOptions,
) => RazorpayCheckoutInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCheckoutConstructor;
  }
}
