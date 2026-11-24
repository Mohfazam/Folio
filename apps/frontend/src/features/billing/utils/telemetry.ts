export type BillingFunnelEvent =
  | "billing_page_viewed"
  | "plan_selected"
  | "checkout_started"
  | "razorpay_order_created"
  | "razorpay_modal_opened"
  | "payment_verified"
  | "payment_reconciling"
  | "payment_dismissed"
  | "payment_failed";

export interface BillingTelemetryPayload {
  event: BillingFunnelEvent;
  planId?: string;
  orderId?: string;
  paymentId?: string;
  reason?: string;
  timestamp: string;
}

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackBillingEvent(
  event: BillingFunnelEvent,
  details: Omit<BillingTelemetryPayload, "event" | "timestamp"> = {},
): void {
  if (typeof window === "undefined") return;

  const payload: BillingTelemetryPayload = {
    event,
    ...details,
    timestamp: new Date().toISOString(),
  };

  try {
    if (Array.isArray(window.dataLayer)) {
      window.dataLayer.push({ event: `foolioo_${event}`, ...payload });
    }
    if (typeof window.gtag === "function") {
      window.gtag("event", event, payload);
    }
    window.dispatchEvent(
      new CustomEvent<BillingTelemetryPayload>("foolioo:billing-telemetry", {
        detail: payload,
      }),
    );
  } catch {
    // Telemetry must never interrupt payment flow.
  }
}
