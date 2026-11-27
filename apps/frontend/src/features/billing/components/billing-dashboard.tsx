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
import { MONTHLY_PLANS, MONTHLY_PLAN_LIST, formatCredits, formatInr } from "../utils/plans";
import { getAvailableLocalDevTestPlan } from "../utils/dev-test-plan";
import { loadRazorpayCheckoutScript } from "../utils/razorpay";
import { trackBillingEvent } from "../utils/telemetry";
import { LocalDevTestPlanCard } from "./local-dev-test-plan-card";

type CheckoutStage =
  | "idle"
  | "creating_order"
  | "checkout_open"
  | "verifying"
  | "reconciling"
  | "succeeded"
  | "cancelled"
  | "failed";

type ActiveCheckoutSelection =
  | { kind: "plan"; planId: PurchasablePlanId }
  | { kind: "dev_test" };

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

export function BillingDashboard({
  isLocalDevTestAvailable = false,
}: {
  isLocalDevTestAvailable?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profile = useDashboardProfile();

  const localDevPlan = useMemo(
    () => getAvailableLocalDevTestPlan(isLocalDevTestAvailable),
    [isLocalDevTestAvailable],
  );

  const rawPlanParam = searchParams.get("plan");
  const isDevTestParamRequested = rawPlanParam === "dev_test" && Boolean(localDevPlan);

  const requestedPlan = useMemo(
    () => normalizePurchasablePlanId(rawPlanParam),
    [rawPlanParam],
  );

  const [selection, setSelection] = useState<ActiveCheckoutSelection>(
    isDevTestParamRequested ? { kind: "dev_test" } : { kind: "plan", planId: requestedPlan ?? "pro" },
  );
  const [stage, setStage] = useState<CheckoutStage>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [scriptBlockedHint, setScriptBlockedHint] = useState(false);
  const [receipt, setReceipt] = useState<VerifyBillingPaymentResponse | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedDiagnostics, setCopiedDiagnostics] = useState(false);

  // #1 Optional pre-checkout billing & invoice fields
  const [billingName, setBillingName] = useState(profile.displayName || "");
  const [billingPhone, setBillingPhone] = useState("");
  const [companyName, setCompanyName] = useState(profile.workspaceName || "");
  const [gstin, setGstin] = useState("");

  const submitLockRef = useRef(false);
  const attemptIdempotencyRef = useRef<{ targetKey: string; key: string } | null>(null);
  const viewedTrackedRef = useRef(false);

  const activePlanIdForApi: PurchasablePlanId =
    selection.kind === "dev_test"
      ? ("dev_test" as unknown as PurchasablePlanId)
      : selection.planId;

  useEffect(() => {
    if (!viewedTrackedRef.current) {
      viewedTrackedRef.current = true;
      trackBillingEvent("billing_page_viewed", {
        planId: isDevTestParamRequested ? "dev_test" : (requestedPlan ?? "pro"),
      });
    }
  }, [isDevTestParamRequested, requestedPlan]);

  useEffect(() => {
    if (isDevTestParamRequested) {
      setSelection({ kind: "dev_test" });
    } else if (requestedPlan) {
      setSelection({ kind: "plan", planId: requestedPlan });
    } else if (selection.kind === "dev_test" && !localDevPlan) {
      setSelection({ kind: "plan", planId: "pro" });
    }
  }, [isDevTestParamRequested, requestedPlan, localDevPlan, selection.kind]);

  useEffect(() => {
    if (!billingName && profile.displayName) setBillingName(profile.displayName);
    if (!companyName && profile.workspaceName) setCompanyName(profile.workspaceName);
  }, [profile.displayName, profile.workspaceName, billingName, companyName]);

  const billingQuery = useBillingStatus({ poll: stage === "reconciling" });
  const createOrderMutation = useCreateRazorpayOrder();
  const verifyPaymentMutation = useVerifyRazorpayPayment();

  const selectedStandardPlan =
    selection.kind === "plan" ? MONTHLY_PLANS[selection.planId] : MONTHLY_PLANS.pro;

  const checkoutSummary = useMemo(() => {
    if (selection.kind === "dev_test" && localDevPlan) {
      return {
        targetKey: "dev_test",
        planIdForApi: "dev_test" as unknown as PurchasablePlanId,
        name: localDevPlan.name,
        priceInr: localDevPlan.amountInr,
        credits: 0,
        creditsLabel: localDevPlan.creditsLabel,
        estimateLabel: "Localhost test verification (100 paise)",
        description: `${localDevPlan.name} · ${localDevPlan.creditsLabel}`,
        isDevTest: true,
      };
    }
    return {
      targetKey: selectedStandardPlan.id,
      planIdForApi: selectedStandardPlan.id,
      name: `${selectedStandardPlan.name} Plan`,
      priceInr: selectedStandardPlan.priceInr,
      credits: selectedStandardPlan.credits,
      creditsLabel: `+${formatCredits(selectedStandardPlan.credits)} credits`,
      estimateLabel: selectedStandardPlan.estimateLabel,
      description: `${selectedStandardPlan.name} Plan · ${formatCredits(selectedStandardPlan.credits)} monthly credits`,
      isDevTest: false,
    };
  }, [selection, localDevPlan, selectedStandardPlan]);

  // #3 Detect trial expiration or low/exhausted credits for tailored pack guidance
  const creditsBalance = billingQuery.data?.creditsBalance ?? null;
  const creditsAllowance = billingQuery.data?.creditsAllowance ?? null;
  const isCreditsLowOrExhausted =
    typeof creditsBalance === "number" &&
    typeof creditsAllowance === "number" &&
    creditsAllowance > 0 &&
    creditsBalance / creditsAllowance <= 0.2;
  const recommendedPackId: PurchasablePlanId =
    profile.trialExpired || (typeof creditsBalance === "number" && creditsBalance === 0)
      ? "pro"
      : "growth";

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
        newCreditsBalance: billingQuery.data.creditsBalance ?? null,
        paymentId: settled.paymentId ?? "confirmed_via_webhook",
        orderId: settled.orderId,
        method: settled.method ?? null,
      };
      setReceipt(resolvedReceipt);
      setStage("succeeded");
      setFeedbackMessage(null);
      setScriptBlockedHint(false);
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

  const getOrCreateAttemptKey = (targetKey: string): string => {
    if (attemptIdempotencyRef.current?.targetKey === targetKey) {
      return attemptIdempotencyRef.current.key;
    }
    const key = generateIdempotencyKey(targetKey);
    attemptIdempotencyRef.current = { targetKey, key };
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

  // #4 Safe diagnostic bundle (excludes tokens, passwords, or secrets)
  const handleCopyDiagnostics = async () => {
    const diag = {
      app: "Foolioo Billing",
      route: "/dashboard/billing",
      workspaceId: profile.workspaceId ?? "unknown",
      selectedPlanId: checkoutSummary.targetKey,
      stage,
      pendingOrderId,
      razorpayScriptPresent: typeof window !== "undefined" ? Boolean(window.Razorpay) : false,
      online: typeof navigator !== "undefined" ? navigator.onLine : true,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      timestamp: new Date().toISOString(),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(diag, null, 2));
      setCopiedDiagnostics(true);
      window.setTimeout(() => setCopiedDiagnostics(false), 2500);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleSelectPlan = (planId: PurchasablePlanId) => {
    if (submitLockRef.current) return;
    setSelection({ kind: "plan", planId });
    attemptIdempotencyRef.current = null;
    if (stage === "cancelled" || stage === "failed") {
      setStage("idle");
      setFeedbackMessage(null);
      setScriptBlockedHint(false);
    }
    trackBillingEvent("plan_selected", { planId });
    router.replace(`/dashboard/billing?plan=${encodeURIComponent(planId)}`, { scroll: false });
  };

  const handleSelectDevTestPlan = () => {
    if (submitLockRef.current || !localDevPlan) return;
    setSelection({ kind: "dev_test" });
    attemptIdempotencyRef.current = null;
    if (stage === "cancelled" || stage === "failed") {
      setStage("idle");
      setFeedbackMessage(null);
      setScriptBlockedHint(false);
    }
    trackBillingEvent("plan_selected", { planId: "dev_test" as unknown as PurchasablePlanId });
    router.replace("/dashboard/billing?plan=dev_test", { scroll: false });
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

    if (checkoutSummary.isDevTest && !localDevPlan) {
      setStage("failed");
      setFeedbackMessage("The ₹1 dev test plan is only available on localhost.");
      return;
    }

    submitLockRef.current = true;
    setFeedbackMessage(null);
    setScriptBlockedHint(false);
    setReceipt(null);
    setStage("creating_order");

    const idempotencyKey = getOrCreateAttemptKey(checkoutSummary.targetKey);
    trackBillingEvent("checkout_started", { planId: checkoutSummary.planIdForApi });

    try {
      const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (isOffline) {
        submitLockRef.current = false;
        setStage("failed");
        setScriptBlockedHint(true);
        setFeedbackMessage(
          "Your device appears to be offline. Reconnect to the internet and try your payment again.",
        );
        return;
      }

      const scriptReady = await loadRazorpayCheckoutScript();
      if (!scriptReady || !window.Razorpay) {
        submitLockRef.current = false;
        setStage("failed");
        setScriptBlockedHint(true);
        setFeedbackMessage(
          "Razorpay Checkout could not load in your browser. An ad-blocker, strict privacy shield, or in-app browser may be blocking checkout.razorpay.com.",
        );
        trackBillingEvent("payment_failed", {
          planId: checkoutSummary.planIdForApi,
          reason: "script_load_failed",
        });
        return;
      }

      const order = await createOrderMutation.mutateAsync({
        planId: checkoutSummary.planIdForApi,
        idempotencyKey,
        billingDetails: {
          name: billingName.trim() || profile.displayName || undefined,
          email: profile.email || undefined,
          contact: billingPhone.trim() || undefined,
          companyName: companyName.trim() || profile.workspaceName || undefined,
          gstin: gstin.trim() || undefined,
        },
      });

      trackBillingEvent("razorpay_order_created", {
        planId: checkoutSummary.planIdForApi,
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
        description: checkoutSummary.description,
        image: "/Foolioo.svg",
        order_id: order.orderId,
        prefill: {
          name: order.prefill?.name || billingName.trim() || profile.displayName || undefined,
          email: order.prefill?.email || profile.email || undefined,
          contact: order.prefill?.contact || billingPhone.trim() || undefined,
        },
        notes: {
          planId: checkoutSummary.targetKey,
          workspaceId: profile.workspaceId ?? "",
          companyName: companyName.trim() || profile.workspaceName || "",
          ...(gstin.trim() ? { gstin: gstin.trim() } : {}),
          paymentType: checkoutSummary.isDevTest ? "localhost_dev_test" : "monthly_subscription",
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
                  planId: checkoutSummary.planIdForApi,
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
              planId: checkoutSummary.planIdForApi,
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
                planId: checkoutSummary.planIdForApi,
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
              });
              return;
            }

            attemptIdempotencyRef.current = null;
            setReceipt(verification);
            setStage("succeeded");
            trackBillingEvent("payment_verified", {
              planId: checkoutSummary.planIdForApi,
              orderId: verification.orderId,
              paymentId: verification.paymentId,
            });
            router.refresh();
          } catch (verifyErr) {
            submitLockRef.current = false;
            setStage("reconciling");
            setFeedbackMessage(
              verifyErr instanceof Error
                ? `${verifyErr.message} Checking order status automatically...`
                : "Checking final payment confirmation with server...",
            );
            trackBillingEvent("payment_reconciling", {
              planId: checkoutSummary.planIdForApi,
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
          planId: checkoutSummary.planIdForApi,
          orderId: order.orderId,
          reason,
        });
      });

      trackBillingEvent("razorpay_modal_opened", {
        planId: checkoutSummary.planIdForApi,
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
        planId: checkoutSummary.planIdForApi,
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
          <h1 className="mt-1.5 font-['Newsreader'] text-[36px] leading-[1.12] tracking-[-0.7px] text-[#1B1C18] sm:text-[42px]">
            Monthly subscription plans
          </h1>
          <p className="mt-2 max-w-[620px] font-['Space_Grotesk'] text-[14px] leading-[21px] text-[#666A68]">
            Subscribe monthly via Razorpay to unlock your selected plan tier and receive your full monthly credit allowance immediately.
          </p>
        </div>

        <div className="rounded-[9px] border border-[#E6E4DC] bg-[#FBFAF6] px-4 py-2.5">
          <p className="font-['Space_Grotesk'] text-[12px] font-semibold uppercase tracking-[0.08em] text-[#747878]">
            Current Workspace Tier
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-['Space_Grotesk'] text-[14.5px] font-bold text-[#1B1C18]">
              {activePlanLabel}
            </span>
            {typeof creditsBalance === "number" ? (
              <span className="rounded-full bg-[#EFEAFB] px-2.5 py-0.5 font-['Space_Grotesk'] text-[13px] font-semibold text-[#644ABB]">
                {formatCredits(creditsBalance)} credits left
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* #3 Trial Expired / Low Credits Guidance Callout */}
      {(profile.trialExpired || isCreditsLowOrExhausted) && stage !== "succeeded" ? (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 ${
            profile.trialExpired || creditsBalance === 0
              ? "border-[#FECACA] bg-[#FEF2F2] text-[#7F1D1D]"
              : "border-[#FDE68A] bg-[#FFFBEB] text-[#78350F]"
          }`}
        >
          <div>
            <p className="font-['Space_Grotesk'] text-[14px] font-semibold">
              {profile.trialExpired
                ? "Your trial period has ended — pick a monthly plan to resume calling."
                : creditsBalance === 0
                  ? "Your voice credits are exhausted — top up now to keep campaigns running."
                  : `Your voice credits are running low (${formatCredits(creditsBalance ?? 0)} remaining).`}
            </p>
            <p className="mt-0.5 font-['Space_Grotesk'] text-[14px] opacity-90">
              Recommended for your workspace:{" "}
              <strong className="font-semibold">{MONTHLY_PLANS[recommendedPackId].name}</strong> (
              {formatCredits(MONTHLY_PLANS[recommendedPackId].credits)} credits ·{" "}
              {formatInr(MONTHLY_PLANS[recommendedPackId].priceInr)}/mo).
            </p>
          </div>
          {selection.kind === "plan" && selection.planId !== recommendedPackId ? (
            <button
              type="button"
              onClick={() => handleSelectPlan(recommendedPackId)}
              className="shrink-0 rounded-lg bg-[#1B1C18] px-3.5 py-2 font-['Space_Grotesk'] text-[14px] font-semibold text-white transition hover:bg-[#34352F]"
            >
              Select {MONTHLY_PLANS[recommendedPackId].name}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Pre-Backend Notice */}
      {isBackendUnconfigured ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6E4DC] bg-[#FBFAF6] px-5 py-4"
        >
          <div>
            <p className="font-['Space_Grotesk'] text-[15px] font-semibold text-[#1B1C18]">
              Checkout preview ready · Awaiting backend billing connection
            </p>
            <p className="mt-0.5 font-['Space_Grotesk'] text-[14px] text-[#666A68]">
              Online Razorpay checkout will activate automatically as soon as the backend{" "}
              <code className="rounded bg-[#EFECE3] px-1.5 py-0.5 font-mono text-[13px]">
                /api/billing/*
              </code>{" "}
              endpoints are deployed.
            </p>
          </div>
          <span className="rounded-full bg-[#EFECE3] px-3 py-1 font-['Space_Grotesk'] text-[12px] font-bold uppercase tracking-[0.08em] text-[#565B5B]">
            Frontend Ready
          </span>
        </div>
      ) : null}

      {/* Webhook Reconciliation Banner */}
      {stage === "reconciling" ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#E7DEFF] bg-[#F7F4FF] p-4 text-[#4C30A2]"
        >
          <div className="space-y-1">
            <p className="font-['Space_Grotesk'] text-[14px] font-semibold">
              Confirming payment settlement...
            </p>
            <p className="font-['Space_Grotesk'] text-[14px] leading-[1.55]">
              {feedbackMessage ?? "Waiting for final confirmation from Razorpay. This updates automatically."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void billingQuery.refetch()}
            className="shrink-0 rounded-lg border border-[#D4C7FA] bg-white px-3.5 py-2 font-['Space_Grotesk'] text-[14px] font-semibold text-[#4C30A2] transition hover:bg-[#EFEAFB]"
          >
            Refresh status
          </button>
        </div>
      ) : null}

      {/* Success Receipt Banner */}
      {stage === "succeeded" && receipt ? (
        <div
          role="status"
          className="rounded-xl border border-[#22A06B]/30 bg-[#EAF8F1] p-5 text-[#14532D]"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 font-['Space_Grotesk'] text-[12px] font-bold uppercase tracking-[0.1em] text-[#18794E]">
                  ✓ Payment Verified · Monthly Subscription
                </span>
                {receipt.method ? (
                  <span className="rounded-full bg-white/80 px-2.5 py-1 font-['Space_Grotesk'] text-[12px] font-semibold uppercase tracking-[0.08em] text-[#264D3B]">
                    Paid via {receipt.method}
                  </span>
                ) : null}
              </div>

              <h2 className="font-['Newsreader'] text-[25px] leading-tight text-[#1B1C18]">
                {formatCredits(receipt.creditsGranted)} credits added to {profile.workspaceName}
              </h2>

              <p className="font-['Space_Grotesk'] text-[14px] text-[#264D3B]">
                Your workspace now has the <strong className="font-semibold capitalize">{receipt.planId}</strong> plan entitlement and{" "}
                <strong className="font-semibold">{formatCredits(receipt.newCreditsBalance ?? 0)} total credits</strong> ready for calls.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[13px] text-[#264D3B]">
                <button
                  type="button"
                  onClick={() => void handleCopy(receipt.paymentId)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#22A06B]/25 bg-white/80 px-2.5 py-1 transition hover:bg-white"
                >
                  <span>Payment: {receipt.paymentId}</span>
                  <span className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#18794E]">
                    {copiedId === receipt.paymentId ? "Copied" : "Copy"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopy(receipt.orderId)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#22A06B]/25 bg-white/80 px-2.5 py-1 transition hover:bg-white"
                >
                  <span>Order: {receipt.orderId}</span>
                  <span className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#18794E]">
                    {copiedId === receipt.orderId ? "Copied" : "Copy"}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/dashboard/campaigns"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[14px] font-semibold text-white transition-colors hover:bg-[#34352F]"
              >
                Launch Campaign →
              </Link>
              <Link
                href="/dashboard/analytics"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-[#22A06B]/30 bg-white px-4 font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18] transition-colors hover:bg-[#F5FBF8]"
              >
                View Usage
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Failure / Cancelled Banner + #4 Script/Network Diagnostics */}
      {(stage === "failed" || stage === "cancelled") && feedbackMessage ? (
        <div
          role="alert"
          className={`rounded-xl border p-4 ${
            stage === "failed"
              ? "border-[#EF4444]/30 bg-[#FFF1F0] text-[#991B1B]"
              : "border-[#E6E4DC] bg-[#F8F7F2] text-[#444748]"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="font-['Space_Grotesk'] text-[14px] leading-[1.55]">{feedbackMessage}</p>
            <div className="flex flex-wrap items-center gap-2">
              {stage === "failed" ? (
                <button
                  type="button"
                  onClick={() => void handleCopyDiagnostics()}
                  className="rounded-lg border border-current/20 bg-white/80 px-3 py-2 font-['Space_Grotesk'] text-[13px] font-semibold transition hover:bg-white"
                >
                  {copiedDiagnostics ? "Diagnostics copied" : "Copy diagnostic info"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void handlePayNow()}
                className="shrink-0 rounded-lg bg-[#1B1C18] px-3.5 py-2 font-['Space_Grotesk'] text-[14px] font-semibold text-white transition-colors hover:bg-[#34352F]"
              >
                Try payment again
              </button>
            </div>
          </div>
          {scriptBlockedHint ? (
            <p className="mt-2.5 border-t border-current/15 pt-2.5 font-['Space_Grotesk'] text-[13px] leading-5 opacity-90">
              Tip: Disable ad-blockers/tracker shields for this site or open Foolioo in Chrome/Safari rather than an embedded in-app browser, then retry.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Localhost-only ₹1 Dev Test Plan Card */}
      <LocalDevTestPlanCard
        isLocalDevTestAvailable={isLocalDevTestAvailable}
        onSelectPlan={handleSelectDevTestPlan}
      />

      {/* 1. All 3 Plans Grid */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-['Space_Grotesk'] text-[14px] font-bold uppercase tracking-[0.09em] text-[#747878]">
            1. Choose a monthly plan (Growth, Pro, or Scale)
          </h2>
          <span className="font-['Space_Grotesk'] text-[13px] text-[#747878]">
            ~1 credit = 10s connected talk time
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {MONTHLY_PLAN_LIST.map((plan) => {
            const isSelected = selection.kind === "plan" && plan.id === selection.planId;
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
                  <span className="mb-3 inline-flex w-fit rounded-full bg-[#1B1C18] px-2.5 py-1 font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-[1.4px] text-white">
                    {plan.badge || "MONTHLY PLAN"}
                  </span>

                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-['Space_Grotesk'] text-[20px] font-bold text-[#1B1C18]">
                      {plan.name}
                    </h3>
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border text-[13px] ${
                        isSelected
                          ? "border-[#1B1C18] bg-[#1B1C18] text-white"
                          : "border-[#D5D3C8] bg-white text-transparent"
                      }`}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  </div>

                  <p className="mt-1.5 font-['Space_Grotesk'] text-[14px] leading-[1.45] text-[#747878]">
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
                      <span className="font-['Space_Grotesk'] text-[14px] font-medium text-[#747878]">
                        / month
                      </span>
                    </div>

                    <div className="mt-3 space-y-1">
                      <p className="font-['Space_Grotesk'] text-[15px] font-semibold text-[#1B1C18]">
                        {formatCredits(plan.credits)} credits
                      </p>
                      <p className="font-['Space_Grotesk'] text-[14px] text-[#747878]">
                        {plan.estimateLabel} · {plan.roughlyCalls}
                      </p>
                    </div>
                  </div>

                  <ul className="mt-4 space-y-2 border-t border-[#F1F0EA] pt-4">
                    {plan.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 font-['Space_Grotesk'] text-[14px] leading-[1.4] text-[#444748]"
                      >
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E3FCEF] text-[12px] text-[#22A06B]">
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
      </div>

      {/* 2. Billing Details & Checkout Summary */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* #1 Pre-Checkout Billing & Invoice Details */}
        <section className="rounded-2xl border border-[#E6E4DC] bg-white p-6 lg:col-span-7">
          <h2 className="font-['Space_Grotesk'] text-[14px] font-bold uppercase tracking-[0.09em] text-[#747878]">
            2. Billing & invoice details (optional)
          </h2>
          <p className="mt-1 font-['Space_Grotesk'] text-[14px] text-[#747878]">
            Pre-fills Razorpay Checkout and attaches organization/GST details to your order notes.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="font-['Space_Grotesk'] text-[12px] font-semibold uppercase tracking-[0.08em] text-[#747878]">
                Billing contact name
              </span>
              <input
                type="text"
                value={billingName}
                onChange={(e) => setBillingName(e.target.value)}
                placeholder="Your full name"
                className="mt-1.5 h-10 w-full rounded-lg border border-[#E5E4DC] bg-[#FBFAF6] px-3 font-['Space_Grotesk'] text-[14px] text-[#1B1C18] outline-none transition focus:border-[#1B1C18] focus:bg-white"
              />
            </label>

            <label className="block">
              <span className="font-['Space_Grotesk'] text-[12px] font-semibold uppercase tracking-[0.08em] text-[#747878]">
                Phone number (for receipt/UPI)
              </span>
              <input
                type="tel"
                value={billingPhone}
                onChange={(e) => setBillingPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="mt-1.5 h-10 w-full rounded-lg border border-[#E5E4DC] bg-[#FBFAF6] px-3 font-['Space_Grotesk'] text-[14px] text-[#1B1C18] outline-none transition focus:border-[#1B1C18] focus:bg-white"
              />
            </label>

            <label className="block">
              <span className="font-['Space_Grotesk'] text-[12px] font-semibold uppercase tracking-[0.08em] text-[#747878]">
                Company / workspace name
              </span>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Organization name"
                className="mt-1.5 h-10 w-full rounded-lg border border-[#E5E4DC] bg-[#FBFAF6] px-3 font-['Space_Grotesk'] text-[14px] text-[#1B1C18] outline-none transition focus:border-[#1B1C18] focus:bg-white"
              />
            </label>

            <label className="block">
              <span className="font-['Space_Grotesk'] text-[12px] font-semibold uppercase tracking-[0.08em] text-[#747878]">
                GSTIN (optional)
              </span>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="22AAAAA0000A1Z5"
                maxLength={20}
                className="mt-1.5 h-10 w-full rounded-lg border border-[#E5E4DC] bg-[#FBFAF6] px-3 font-mono text-[14px] uppercase text-[#1B1C18] outline-none transition focus:border-[#1B1C18] focus:bg-white"
              />
            </label>
          </div>
        </section>

        {/* Checkout Summary */}
        <aside className="lg:col-span-5">
          <div className="rounded-2xl border border-[#E6E4DC] bg-[#FFFEFB] p-6 shadow-[0_8px_28px_rgba(27,28,24,0.04)]">
            <h2 className="font-['Space_Grotesk'] text-[14px] font-bold uppercase tracking-[0.09em] text-[#747878]">
              3. Checkout summary
            </h2>
            <div className="mt-4 flex items-baseline justify-between border-b border-[#ECEBE4] pb-4">
              <div>
                <p className="font-['Newsreader'] text-[26px] leading-tight text-[#1B1C18]">
                  {checkoutSummary.name}
                </p>
                <p className="mt-0.5 font-['Space_Grotesk'] text-[14px] text-[#747878]">
                  {checkoutSummary.isDevTest
                    ? "Localhost dev test order · 100 paise"
                    : "Monthly subscription · Instant credit grant"}
                </p>
              </div>
              <span className="font-['Space_Grotesk'] text-[26px] font-bold text-[#1B1C18]">
                {formatInr(checkoutSummary.priceInr)}
              </span>
            </div>

            <dl className="mt-4 space-y-2.5 font-['Space_Grotesk'] text-[14px]">
              <div className="flex items-center justify-between">
                <dt className="text-[#666A68]">Workspace</dt>
                <dd className="font-medium text-[#1B1C18]">{companyName.trim() || profile.workspaceName}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#666A68]">Credits granted</dt>
                <dd className="font-semibold text-[#1B1C18]">
                  {checkoutSummary.creditsLabel}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-[#666A68]">Talk time estimate</dt>
                <dd className="text-[#444748]">{checkoutSummary.estimateLabel}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => void handlePayNow()}
              disabled={isBusy}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[14.5px] font-semibold text-white transition hover:bg-[#34352F] disabled:opacity-60"
            >
              {stage === "creating_order"
                ? "Preparing Razorpay order..."
                : stage === "checkout_open"
                  ? "Complete payment in Razorpay..."
                  : stage === "verifying"
                    ? "Verifying payment signature..."
                    : `Pay ${formatInr(checkoutSummary.priceInr)} with Razorpay`}
            </button>
          </div>
        </aside>
      </div>

      {/* Payment History */}
      <section className="rounded-2xl border border-[#E6E4DC] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0EFEA] pb-4">
          <div>
            <h2 className="font-['Newsreader'] text-[24px] leading-tight text-[#1B1C18]">Payment history</h2>
            <p className="mt-0.5 font-['Space_Grotesk'] text-[14px] text-[#747878]">
              Monthly subscription payments recorded for this workspace.
            </p>
          </div>
          {billingQuery.isFetching ? (
            <span className="font-['Space_Grotesk'] text-[13px] text-[#85877F]">Syncing...</span>
          ) : null}
        </div>

        {billingData?.orders && billingData.orders.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left font-['Space_Grotesk'] text-[14px]">
              <thead>
                <tr className="border-b border-[#ECEBE4] text-[12px] font-bold uppercase tracking-[0.08em] text-[#85877F]">
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
                      <td className="py-3 pr-4 text-[#34352F]">{formatInr(order.amountInr)}</td>
                      <td className="py-3 pr-4 font-medium text-[#1B1C18]">
                        +{formatCredits(order.creditsGranted)}
                      </td>
                      <td className="py-3 pr-4 uppercase text-[13px] text-[#666A68]">
                        {order.method || "Razorpay"}
                      </td>
                      <td className="py-3 pr-4 font-mono text-[13px] text-[#666A68]">
                        <button
                          type="button"
                          onClick={() => void handleCopy(refId)}
                          className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 transition hover:bg-[#F5F4ED]"
                        >
                          <span>{refId}</span>
                          <span className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#644ABB]">
                            {copiedId === refId ? "Copied" : "Copy"}
                          </span>
                        </button>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-semibold uppercase tracking-[0.06em] ${
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
          <p className="mt-3 font-['Space_Grotesk'] text-[14px] text-[#747878]">
            {isBackendUnconfigured
              ? "Payment history will appear here once the backend billing endpoint is connected."
              : "No subscription payments recorded yet. Select Growth, Pro, or Scale above and click Pay with Razorpay to subscribe."}
          </p>
        )}
      </section>
    </div>
  );
}
