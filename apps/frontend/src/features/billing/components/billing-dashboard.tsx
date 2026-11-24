"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDashboardProfile } from "@/components/dashboard/dashboard-shell";
import { useBillingStatus, useCreateRazorpayOrder, useVerifyRazorpayPayment } from "../hooks/use-billing";
import { BillingApiError } from "../queries/api";
import { normalizePurchasablePlanId } from "../schemas";
import type {
  PurchasablePlanId,
  RazorpayFailureResponse,
  RazorpaySuccessPayload,
  VerifyBillingPaymentResponse,
} from "../types";
import { ONE_TIME_PLANS, ONE_TIME_PLAN_LIST, formatCredits, formatInr } from "../utils/plans";
import { loadRazorpayCheckoutScript } from "../utils/razorpay";
import { trackBillingEvent } from "../utils/telemetry";

type CheckoutStage =
  | "idle"
  | "creating_order"
  | "checkout_open"
  | "verifying"
  | "reconciling"
  | "succeeded"
  | "cancelled"
  | "failed";

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function generateIdempotencyKey(planId: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `foolioo_${planId}_${crypto.randomUUID()}`;
  }
  return `foolioo_${planId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function BillingDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profile = useDashboardProfile();

  const requestedPlan = useMemo(
    () => normalizePurchasablePlanId(searchParams.get("plan")),
    [searchParams],
  );

  const [selectedPlanId, setSelectedPlanId] = useState<PurchasablePlanId>(requestedPlan ?? "pro");
  const [stage, setStage] = useState<CheckoutStage>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<VerifyBillingPaymentResponse | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Ref lock + stable idempotency key per checkout attempt (#1)
  const submitLockRef = useRef(false);
  const attemptIdempotencyRef = useRef<{ planId: PurchasablePlanId; key: string } | null>(null);
  const viewedTrackedRef = useRef(false);

  useEffect(() => {
    if (!viewedTrackedRef.current) {
      viewedTrackedRef.current = true;
      trackBillingEvent("billing_page_viewed", { planId: requestedPlan ?? "pro" });
    }
  }, [requestedPlan]);

  useEffect(() => {
    if (requestedPlan) {
      setSelectedPlanId(requestedPlan);
    }
  }, [requestedPlan]);

  // Poll billing status while reconciling webhook settlement (#2)
  const billingQuery = useBillingStatus({ poll: stage === "reconciling" });
  const createOrderMutation = useCreateRazorpayOrder();
  const verifyPaymentMutation = useVerifyRazorpayPayment();
  const selectedPlan = ONE_TIME_PLANS[selectedPlanId];

  // Detect webhook settlement automatically while in reconciling stage (#2)
  useEffect(() => {
    if (stage !== "reconciling" || !pendingOrderId || !billingQuery.data?.orders) return;
    const settled = billingQuery.data.orders.find(
      (o) => o.orderId === pendingOrderId && o.status === "paid",
    );
    if (settled) {
      const resolvedReceipt: VerifyBillingPaymentResponse = {
        ok: true,
        verified: true,
        status: "paid",
        planId: settled.planId,
        planName: settled.planName,
        creditsGranted: settled.creditsGranted,
        newCreditsBalance: billingQuery.data.creditsBalance,
        paymentId: settled.paymentId ?? "confirmed_via_webhook",
        orderId: settled.orderId,
        method: settled.method ?? null,
      };
      setReceipt(resolvedReceipt);
      setStage("succeeded");
      setFeedbackMessage(null);
      attemptIdempotencyRef.current = null;
      trackBillingEvent("payment_verified", {
        planId: settled.planId,
        orderId: settled.orderId,
        paymentId: settled.paymentId ?? undefined,
      });
      router.refresh();
    }
  }, [stage, pendingOrderId, billingQuery.data, router]);

  const isBackendUnconfigured =
    billingQuery.error instanceof BillingApiError &&
    billingQuery.error.isBackendUnconfigured;

  const getOrCreateAttemptKey = (planId: PurchasablePlanId): string => {
    if (attemptIdempotencyRef.current?.planId === planId) {
      return attemptIdempotencyRef.current.key;
    }
    const key = generateIdempotencyKey(planId);
    attemptIdempotencyRef.current = { planId, key };
    return key;
  };

  const handleCopy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(value);
      window.setTimeout(() => {
        setCopiedId((curr) => (curr === value ? null : curr));
      }, 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleSelectPlan = (planId: PurchasablePlanId) => {
    if (submitLockRef.current) return;
    setSelectedPlanId(planId);
    attemptIdempotencyRef.current = null;
    if (stage === "cancelled" || stage === "failed") {
      setStage("idle");
      setFeedbackMessage(null);
    }
    trackBillingEvent("plan_selected", { planId });
    router.replace(`/dashboard/billing?plan=${encodeURIComponent(planId)}`, { scroll: false });
  };

  const handlePayNow = async () => {
    if (
      submitLockRef.current ||
      stage === "creating_order" ||
      stage === "checkout_open" ||
      stage === "verifying"
    ) {
      return;
    }

    submitLockRef.current = true;
    setFeedbackMessage(null);
    setReceipt(null);
    setStage("creating_order");

    const idempotencyKey = getOrCreateAttemptKey(selectedPlan.id);
    trackBillingEvent("checkout_started", { planId: selectedPlan.id });

    try {
      const scriptReady = await loadRazorpayCheckoutScript();
      if (!scriptReady || !window.Razorpay) {
        submitLockRef.current = false;
        setStage("failed");
        setFeedbackMessage(
          "Could not load Razorpay Checkout in your browser. Check your network or ad-blocker and try again.",
        );
        trackBillingEvent("payment_failed", {
          planId: selectedPlan.id,
          reason: "script_load_failed",
        });
        return;
      }

      const order = await createOrderMutation.mutateAsync({
        planId: selectedPlan.id,
        idempotencyKey,
      });

      trackBillingEvent("razorpay_order_created", {
        planId: selectedPlan.id,
        orderId: order.orderId,
      });

      const keyId =
        order.keyId?.trim() || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || "";

      if (!keyId) {
        submitLockRef.current = false;
        setStage("failed");
        setFeedbackMessage(
          "Razorpay public key is not configured yet (NEXT_PUBLIC_RAZORPAY_KEY_ID). Add the key or return it from POST /api/billing/order.",
        );
        return;
      }

      setPendingOrderId(order.orderId);
      setStage("checkout_open");

      const rzp = new window.Razorpay({
        key: keyId,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "Foolioo",
        description: `${selectedPlan.name} Plan · ${formatCredits(selectedPlan.credits)} one-time credits`,
        image: "/Foolioo.svg",
        order_id: order.orderId,
        prefill: {
          name: order.prefill?.name || profile.displayName || undefined,
          email: order.prefill?.email || profile.email || undefined,
          contact: order.prefill?.contact || undefined,
        },
        notes: {
          planId: selectedPlan.id,
          workspaceId: profile.workspaceId ?? "",
          paymentType: "one_time",
        },
        theme: { color: "#1B1C18" },
        modal: {
          escape: true,
          confirm_close: true,
          ondismiss: () => {
            submitLockRef.current = false;
            setStage((current) => {
              if (current === "checkout_open") {
                setFeedbackMessage(
                  "Checkout window closed before payment completed. Your selection is saved—click Pay Now whenever you're ready.",
                );
                trackBillingEvent("payment_dismissed", {
                  planId: selectedPlan.id,
                  orderId: order.orderId,
                });
                return "cancelled";
              }
              return current;
            });
          },
        },
        handler: async (response: RazorpaySuccessPayload) => {
          setStage("verifying");
          setFeedbackMessage(null);
          try {
            const verification = await verifyPaymentMutation.mutateAsync({
              planId: selectedPlan.id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              idempotencyKey,
            });

            submitLockRef.current = false;

            if (verification.status === "pending" && !verification.verified) {
              setStage("reconciling");
              setFeedbackMessage(
                "Payment received by Razorpay and awaiting final webhook confirmation. Your credits will appear automatically in a few seconds.",
              );
              trackBillingEvent("payment_reconciling", {
                planId: selectedPlan.id,
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
              });
              return;
            }

            attemptIdempotencyRef.current = null;
            setReceipt(verification);
            setStage("succeeded");
            trackBillingEvent("payment_verified", {
              planId: selectedPlan.id,
              orderId: verification.orderId,
              paymentId: verification.paymentId,
            });
            router.refresh();
          } catch (verifyErr) {
            submitLockRef.current = false;
            // If network timed out after Razorpay captured payment, allow webhook reconciliation check (#2)
            setStage("reconciling");
            setFeedbackMessage(
              verifyErr instanceof Error
                ? `${verifyErr.message} Checking order status automatically...`
                : "Checking final payment confirmation with server...",
            );
            trackBillingEvent("payment_reconciling", {
              planId: selectedPlan.id,
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
            });
          }
        },
      });

      rzp.on("payment.failed", (failure: RazorpayFailureResponse) => {
        submitLockRef.current = false;
        attemptIdempotencyRef.current = null;
        const reason =
          failure?.error?.description ||
          failure?.error?.reason ||
          "The payment could not be completed by Razorpay.";
        setStage("failed");
        setFeedbackMessage(reason);
        trackBillingEvent("payment_failed", {
          planId: selectedPlan.id,
          orderId: order.orderId,
          reason,
        });
      });

      trackBillingEvent("razorpay_modal_opened", {
        planId: selectedPlan.id,
        orderId: order.orderId,
      });
      rzp.open();
    } catch (err) {
      submitLockRef.current = false;
      const msg =
        err instanceof Error
          ? err.message
          : "Unable to start Razorpay checkout right now. Please try again.";
      setStage("failed");
      setFeedbackMessage(msg);
      trackBillingEvent("payment_failed", {
        planId: selectedPlan.id,
        reason: msg,
      });
    }
  };

  const isBusy =
    stage === "creating_order" ||
    stage === "checkout_open" ||
    stage === "verifying";

  const billingData = billingQuery.data;
  const activePlanLabel = billingData?.currentPlanTier
    ? billingData.currentPlanTier.charAt(0).toUpperCase() + billingData.currentPlanTier.slice(1)
    : profile.planName ?? (profile.isTrial ? "Trial" : "Active");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#ECEBE4] pb-6">
        <div>
          <p className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#747878]">
            BILLING & CREDITS
          </p>
          <h1 className="mt-1.5 font-['Newsreader'] text-[34px] leading-[1.08] tracking-[-0.8px] text-[#1B1C18] sm:text-[40px]">
            One-time credit packs & plans
          </h1>
          <p className="mt-2 max-w-[620px] font-['Space_Grotesk'] text-[13px] leading-[21px] text-[#666A68]">
            Pay once via Razorpay in INR to unlock your selected plan tier and receive the full credit allowance immediately. No automatic recurring charges.
          </p>
        </div>

        <div className="rounded-[9px] border border-[#E6E4DC] bg-[#FBFAF6] px-4 py-2.5">
          <p className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#747878]">
            Current Workspace Tier
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-['Space_Grotesk'] text-[14px] font-bold text-[#1B1C18]">
              {activePlanLabel}
            </span>
            {typeof billingData?.creditsBalance === "number" ? (
              <span className="rounded-full bg-[#EFEAFB] px-2.5 py-0.5 font-['Space_Grotesk'] text-[11px] font-semibold text-[#644ABB]">
                {formatCredits(billingData.creditsBalance)} credits left
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* #5 Graceful Pre-Backend Notice */}
      {isBackendUnconfigured ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6E4DC] bg-[#FBFAF6] px-5 py-4"
        >
          <div>
            <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
              Checkout preview ready · Awaiting backend billing connection
            </p>
            <p className="mt-0.5 font-['Space_Grotesk'] text-[12px] text-[#666A68]">
              Online Razorpay checkout will activate automatically as soon as the backend <code className="rounded bg-[#EFECE3] px-1.5 py-0.5 font-mono text-[11px]">/api/billing/*</code> endpoints are deployed.
            </p>
          </div>
          <span className="rounded-full bg-[#EFECE3] px-3 py-1 font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.08em] text-[#565B5B]">
            Frontend Ready
          </span>
        </div>
      ) : null}

      {/* #2 Webhook Reconciliation Banner */}
      {stage === "reconciling" ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E7DEFF] bg-[#F7F4FF] p-4 text-[#4C30A2]"
        >
          <div className="space-y-1">
            <p className="font-['Space_Grotesk'] text-[13px] font-semibold">
              Confirming payment settlement...
            </p>
            <p className="font-['Space_Grotesk'] text-[12px] leading-5">
              {feedbackMessage ?? "Waiting for final confirmation from Razorpay. This updates automatically."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void billingQuery.refetch()}
            className="shrink-0 rounded-lg border border-[#D4C7FA] bg-white px-3.5 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-[#4C30A2] transition hover:bg-[#EFEAFB]"
          >
            Refresh status
          </button>
        </div>
      ) : null}

      {/* #3 Rich Success Receipt Banner */}
      {stage === "succeeded" && receipt ? (
        <div
          role="status"
          className="rounded-xl border border-[#22A06B]/30 bg-[#EAF8F1] p-5 text-[#14532D]"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.1em] text-[#18794E]">
                  ✓ Payment Verified · One-Time Purchase
                </span>
                {receipt.method ? (
                  <span className="rounded-full bg-white/80 px-2.5 py-1 font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#264D3B]">
                    Paid via {receipt.method}
                  </span>
                ) : null}
              </div>

              <h2 className="font-['Newsreader'] text-[25px] leading-tight text-[#1B1C18]">
                {formatCredits(receipt.creditsGranted)} credits added to {profile.workspaceName}
              </h2>

              <p className="font-['Space_Grotesk'] text-[13px] text-[#264D3B]">
                Your workspace now has the <strong className="font-semibold capitalize">{receipt.planId}</strong> plan entitlement and{" "}
                <strong className="font-semibold">{formatCredits(receipt.newCreditsBalance)} total credits</strong> ready for calls.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[11px] text-[#264D3B]">
                <button
                  type="button"
                  onClick={() => void handleCopy(receipt.paymentId)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#22A06B]/25 bg-white/80 px-2.5 py-1 transition hover:bg-white"
                  title="Copy Razorpay Payment ID"
                >
                  <span>Payment: {receipt.paymentId}</span>
                  <span className="font-['Space_Grotesk'] text-[10px] font-semibold text-[#18794E]">
                    {copiedId === receipt.paymentId ? "Copied" : "Copy"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy(receipt.orderId)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#22A06B]/25 bg-white/80 px-2.5 py-1 transition hover:bg-white"
                  title="Copy Razorpay Order ID"
                >
                  <span>Order: {receipt.orderId}</span>
                  <span className="font-['Space_Grotesk'] text-[10px] font-semibold text-[#18794E]">
                    {copiedId === receipt.orderId ? "Copied" : "Copy"}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/dashboard/campaigns"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F]"
              >
                Launch Campaign →
              </Link>
              <Link
                href="/dashboard/analytics"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[#22A06B]/30 bg-white px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18] transition-colors hover:bg-[#F5FBF8]"
              >
                View Usage
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Failure / Cancelled Banner */}
      {(stage === "failed" || stage === "cancelled") && feedbackMessage ? (
        <div
          role="alert"
          className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 ${
            stage === "failed"
              ? "border-[#EF4444]/30 bg-[#FFF1F0] text-[#991B1B]"
              : "border-[#E6E4DC] bg-[#F8F7F2] text-[#444748]"
          }`}
        >
          <p className="font-['Space_Grotesk'] text-[13px] leading-5">{feedbackMessage}</p>
          <button
            type="button"
            onClick={() => void handlePayNow()}
            className="shrink-0 rounded-lg bg-[#1B1C18] px-3.5 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F]"
          >
            Try payment again
          </button>
        </div>
      ) : null}

      {/* Main Two-Column Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left: Plan Cards with #4 Full Feature Parity */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="font-['Space_Grotesk'] text-[12px] font-bold uppercase tracking-[0.09em] text-[#747878]">
              1. Choose a one-time plan
            </h2>
            <span className="font-['Space_Grotesk'] text-[11px] text-[#747878]">
              ~1 credit = 10s connected talk time
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {ONE_TIME_PLAN_LIST.map((plan) => {
              const isSelected = plan.id === selectedPlanId;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => handleSelectPlan(plan.id)}
                  aria-pressed={isSelected}
                  className={`relative flex flex-col justify-between rounded-2xl p-6 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] ${
                    isSelected
                      ? "border-2 border-[#1B1C18] bg-[#FFFEFB] shadow-[0_12px_32px_rgba(27,28,24,0.08)]"
                      : "border border-[#E6E4DC] bg-white hover:border-[#C9C6BA]"
                  }`}
                >
                  <div>
                    <span className="mb-3 inline-flex w-fit rounded-full bg-[#1B1C18] px-2.5 py-1 font-['Space_Grotesk'] text-[9px] font-bold uppercase tracking-[1.4px] text-white">
                      {plan.badge || "ONE-TIME PACK"}
                    </span>

                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-['Space_Grotesk'] text-[20px] font-bold text-[#1B1C18]">
                        {plan.name}
                      </h3>
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
                          isSelected
                            ? "border-[#1B1C18] bg-[#1B1C18] text-white"
                            : "border-[#D5D3C8] bg-white text-transparent"
                        }`}
                        aria-hidden="true"
                      >
                        ✓
                      </span>
                    </div>

                    <p className="mt-1.5 font-['Space_Grotesk'] text-[12.5px] leading-[1.45] text-[#747878]">
                      {plan.description}
                    </p>

                    <div className="mt-5 border-t border-[#ECEBE4] pt-4">
                      <div className="flex flex-wrap items-baseline gap-2">
                        {plan.originalPriceInr ? (
                          <span className="font-['Space_Grotesk'] text-[16px] font-medium text-[#8C8F8E] line-through">
                            {formatInr(plan.originalPriceInr)}
                          </span>
                        ) : null}
                        <span className="font-['Space_Grotesk'] text-[32px] font-bold tracking-[-0.8px] text-[#1B1C18]">
                          {formatInr(plan.priceInr)}
                        </span>
                        <span className="font-['Space_Grotesk'] text-[12px] font-medium text-[#747878]">
                          one-time
                        </span>
                      </div>

                      <div className="mt-3 space-y-1">
                        <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                          {formatCredits(plan.credits)} credits
                        </p>
                        <p className="font-['Space_Grotesk'] text-[12px] text-[#747878]">
                          {plan.estimateLabel} · {plan.roughlyCalls}
                        </p>
                      </div>
                    </div>

                    {/* Full feature list matching pricing.tsx (#4) */}
                    <ul className="mt-4 space-y-2 border-t border-[#F1F0EA] pt-4">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-2 font-['Space_Grotesk'] text-[12px] leading-[1.4] text-[#444748]"
                        >
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E3FCEF] text-[10px] text-[#22A06B]">
                            ✓
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6E4DC] bg-[#FBFAF6] px-5 py-4">
            <div>
              <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                Need Scale (24,000 credits · ₹16,700) or dedicated SIP trunking?
              </p>
              <p className="mt-0.5 font-['Space_Grotesk'] text-[12px] text-[#747878]">
                Custom carrier routing, SLA, and volume provisioning are handled directly with our team.
              </p>
            </div>
            <a
              href="mailto:sales@foolioo.app?subject=Scale%20Plan%20Inquiry"
              className="shrink-0 rounded-lg border border-[#DCDCD4] bg-white px-3.5 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18] transition-colors hover:bg-[#F5F4ED]"
            >
              Contact sales →
            </a>
          </div>
        </div>

        {/* Right: Checkout Summary */}
        <aside className="lg:col-span-5">
          <div className="sticky top-6 rounded-2xl border border-[#E6E4DC] bg-[#FFFEFB] p-6 shadow-[0_8px_28px_rgba(27,28,24,0.04)]">
            <h2 className="font-['Space_Grotesk'] text-[12px] font-bold uppercase tracking-[0.09em] text-[#747878]">
              2. Checkout summary
            </h2>

            <div className="mt-4 flex items-baseline justify-between border-b border-[#ECEBE4] pb-4">
              <div>
                <p className="font-['Newsreader'] text-[26px] leading-tight text-[#1B1C18]">
                  {selectedPlan.name} Plan
                </p>
                <p className="mt-0.5 font-['Space_Grotesk'] text-[12px] text-[#747878]">
                  One-time payment · Instant credit grant
                </p>
              </div>
              <span className="font-['Space_Grotesk'] text-[26px] font-bold tracking-[-0.6px] text-[#1B1C18]">
                {formatInr(selectedPlan.priceInr)}
              </span>
            </div>

            <dl className="mt-4 space-y-3 font-['Space_Grotesk'] text-[13px]">
              <div className="flex items-center justify-between">
                <dt className="text-[#666A68]">Workspace</dt>
                <dd className="font-medium text-[#1B1C18]">{profile.workspaceName}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#666A68]">Account email</dt>
                <dd className="max-w-[210px] truncate font-medium text-[#1B1C18]">
                  {profile.email || "Authenticated user"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#666A68]">Credits granted</dt>
                <dd className="font-semibold text-[#1B1C18]">
                  +{formatCredits(selectedPlan.credits)} credits
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#666A68]">Estimated talk time</dt>
                <dd className="text-[#444748]">{selectedPlan.estimateLabel}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#666A68]">Billing type</dt>
                <dd className="rounded-full bg-[#F5F3EC] px-2.5 py-0.5 text-[11px] font-semibold text-[#1B1C18]">
                  One-time · No auto-renewal
                </dd>
              </div>
            </dl>

            <div className="mt-5 border-t border-[#ECEBE4] pt-4">
              <div className="flex items-center justify-between">
                <span className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                  Total payable (INR)
                </span>
                <span className="font-['Space_Grotesk'] text-[22px] font-bold text-[#1B1C18]">
                  {formatInr(selectedPlan.priceInr)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => void handlePayNow()}
                disabled={isBusy}
                className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[14px] font-semibold text-white shadow-[0_6px_18px_rgba(27,28,24,0.14)] transition-all hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {stage === "creating_order"
                  ? "Preparing Razorpay order..."
                  : stage === "checkout_open"
                    ? "Complete payment in Razorpay..."
                    : stage === "verifying"
                      ? "Verifying payment signature..."
                      : `Pay ${formatInr(selectedPlan.priceInr)} with Razorpay`}
              </button>

              <p className="mt-3 text-center font-['Space_Grotesk'] text-[11px] leading-[1.5] text-[#85877F]">
                Supports UPI, Credit/Debit Cards, NetBanking, and Wallets via Razorpay. Credits are unlocked immediately upon signature verification.
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* #3 Enhanced Payment History Table */}
      <section className="rounded-2xl border border-[#E6E4DC] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0EFEA] pb-4">
          <div>
            <h2 className="font-['Newsreader'] text-[22px] text-[#1B1C18]">
              Payment history
            </h2>
            <p className="mt-0.5 font-['Space_Grotesk'] text-[12px] text-[#747878]">
              One-time credit purchases recorded for this workspace.
            </p>
          </div>
          {billingQuery.isFetching ? (
            <span className="font-['Space_Grotesk'] text-[11px] text-[#85877F]">
              Syncing...
            </span>
          ) : null}
        </div>

        {billingData?.orders && billingData.orders.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left font-['Space_Grotesk'] text-[12.5px]">
              <thead>
                <tr className="border-b border-[#ECEBE4] text-[10px] font-bold uppercase tracking-[0.08em] text-[#85877F]">
                  <th className="py-2.5 pr-4">Plan</th>
                  <th className="py-2.5 pr-4">Amount</th>
                  <th className="py-2.5 pr-4">Credits</th>
                  <th className="py-2.5 pr-4">Method</th>
                  <th className="py-2.5 pr-4">Reference ID</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F2EC]">
                {billingData.orders.map((order) => {
                  const refId = order.paymentId || order.orderId;
                  return (
                    <tr key={order.orderId}>
                      <td className="py-3 pr-4 font-semibold capitalize text-[#1B1C18]">
                        {order.planName}
                      </td>
                      <td className="py-3 pr-4 text-[#34352F]">
                        {formatInr(order.amountInr)}
                      </td>
                      <td className="py-3 pr-4 font-medium text-[#1B1C18]">
                        +{formatCredits(order.creditsGranted)}
                      </td>
                      <td className="py-3 pr-4 uppercase text-[11px] text-[#666A68]">
                        {order.method || "Razorpay"}
                      </td>
                      <td className="py-3 pr-4 font-mono text-[11px] text-[#666A68]">
                        <button
                          type="button"
                          onClick={() => void handleCopy(refId)}
                          className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 transition hover:bg-[#F5F4ED]"
                          title="Copy reference ID"
                        >
                          <span>{refId}</span>
                          <span className="font-['Space_Grotesk'] text-[10px] font-semibold text-[#644ABB]">
                            {copiedId === refId ? "Copied" : "Copy"}
                          </span>
                        </button>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${
                            order.status === "paid"
                              ? "bg-[#E3FCEF] text-[#18794E]"
                              : order.status === "failed"
                                ? "bg-[#FFF1F0] text-[#B42318]"
                                : "bg-[#F5F4ED] text-[#666A68]"
                          }`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 text-right text-[#666A68]">
                        {formatDateTime(order.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="font-['Space_Grotesk'] text-[13px] font-medium text-[#444748]">
              {isBackendUnconfigured
                ? "Payment history will appear here once the backend billing endpoint is connected."
                : "No one-time payments recorded yet."}
            </p>
            <p className="mt-1 font-['Space_Grotesk'] text-[12px] text-[#85877F]">
              Select Growth or Pro above and click Pay with Razorpay to purchase credits.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
