export type StandardPurchasablePlanId = "growth" | "pro" | "scale";
export type LocalDevTestPlanId = "dev_test";
export type PurchasablePlanId = StandardPurchasablePlanId | LocalDevTestPlanId;

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
  currentPlanTier?: string | null;
  creditsBalance?: number | null;
  creditsAllowance?: number | null;
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
  newCreditsBalance: number | null | undefined;
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
