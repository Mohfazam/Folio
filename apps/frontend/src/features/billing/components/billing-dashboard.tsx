"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useDashboardProfile } from "@/components/dashboard/dashboard-shell";
import { useBillingStatus, useCreateRazorpayOrder, useVerifyRazorpayPayment } from "../hooks/use-billing";
import { normalizePurchasablePlanId } from "../schemas";
import type { PurchasablePlanId, RazorpayFailureResponse, RazorpaySuccessPayload, VerifyBillingPaymentResponse } from "../types";
import { ONE_TIME_PLANS, ONE_TIME_PLAN_LIST, formatCredits, formatInr } from "../utils/plans";
import { loadRazorpayCheckoutScript } from "../utils/razorpay";

type CheckoutStage = "idle" | "creating_order" | "checkout_open" | "verifying" | "succeeded" | "cancelled" | "failed";

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(date);
}

export function BillingDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const profile = useDashboardProfile();

  const requestedPlan = useMemo(() => normalizePurchasablePlanId(searchParams.get("plan")), [searchParams]);
  const [selectedPlanId, setSelectedPlanId] = useState<PurchasablePlanId>(requestedPlan ?? "pro");
  const [stage, setStage] = useState<CheckoutStage>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<VerifyBillingPaymentResponse | null>(null);

  useEffect(() => {
    if (requestedPlan) setSelectedPlanId(requestedPlan);
  }, [requestedPlan]);

  const billingQuery = useBillingStatus();
  const createOrderMutation = useCreateRazorpayOrder();
  const verifyPaymentMutation = useVerifyRazorpayPayment();
  const selectedPlan = ONE_TIME_PLANS[selectedPlanId];

  const handleSelectPlan = (planId: PurchasablePlanId) => {
    setSelectedPlanId(planId);
    if (stage === "cancelled" || stage === "failed") {
      setStage("idle");
      setFeedbackMessage(null);
    }
    router.replace(`/dashboard/billing?plan=${encodeURIComponent(planId)}`, { scroll: false });
  };

  const handlePayNow = async () => {
    if (stage === "creating_order" || stage === "checkout_open" || stage === "verifying") return;
    setFeedbackMessage(null);
    setReceipt(null);
    setStage("creating_order");

    try {
      const scriptReady = await loadRazorpayCheckoutScript();
      if (!scriptReady || !window.Razorpay) {
        setStage("failed");
        setFeedbackMessage("Could not load Razorpay Checkout in your browser. Check your network or ad-blocker and try again.");
        return;
      }

      const order = await createOrderMutation.mutateAsync({ planId: selectedPlan.id });
      const keyId = order.keyId?.trim() || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID?.trim() || "";
      if (!keyId) {
        setStage("failed");
        setFeedbackMessage("Razorpay public key is not configured yet (NEXT_PUBLIC_RAZORPAY_KEY_ID).");
        return;
      }

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
            setStage((current) => {
              if (current === "checkout_open") {
                setFeedbackMessage("Checkout window closed before payment completed. Click Pay Now whenever you're ready.");
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
            });
            setReceipt(verification);
            setStage("succeeded");
            router.refresh();
          } catch (verifyErr) {
            setStage("failed");
            setFeedbackMessage(verifyErr instanceof Error ? verifyErr.message : "Payment verification failed.");
          }
        },
      });

      rzp.on("payment.failed", (failure: RazorpayFailureResponse) => {
        setStage("failed");
        setFeedbackMessage(failure?.error?.description || failure?.error?.reason || "Payment could not be completed.");
      });

      rzp.open();
    } catch (err) {
      setStage("failed");
      setFeedbackMessage(err instanceof Error ? err.message : "Unable to start Razorpay checkout right now.");
    }
  };

  const isBusy = stage === "creating_order" || stage === "checkout_open" || stage === "verifying";
  const billingData = billingQuery.data;
  const activePlanLabel = billingData?.currentPlanTier
    ? billingData.currentPlanTier.charAt(0).toUpperCase() + billingData.currentPlanTier.slice(1)
    : profile.planName ?? (profile.isTrial ? "Trial" : "Active");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#ECEBE4] pb-6">
        <div>
          <p className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#747878]">BILLING & CREDITS</p>
          <h1 className="mt-1.5 font-['Newsreader'] text-[34px] leading-[1.08] tracking-[-0.8px] text-[#1B1C18] sm:text-[40px]">One-time credit packs & plans</h1>
          <p className="mt-2 max-w-[620px] font-['Space_Grotesk'] text-[13px] leading-[21px] text-[#666A68]">
            Pay once via Razorpay in INR to unlock your selected plan tier and receive the full credit allowance immediately. No automatic recurring charges.
          </p>
        </div>

        <div className="rounded-[9px] border border-[#E6E4DC] bg-[#FBFAF6] px-4 py-2.5">
          <p className="font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#747878]">Current Workspace Tier</p>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-['Space_Grotesk'] text-[14px] font-bold text-[#1B1C18]">{activePlanLabel}</span>
            {typeof billingData?.creditsBalance === "number" ? (
              <span className="rounded-full bg-[#EFEAFB] px-2.5 py-0.5 font-['Space_Grotesk'] text-[11px] font-semibold text-[#644ABB]">
                {formatCredits(billingData.creditsBalance)} credits left
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {stage === "succeeded" && receipt ? (
        <div role="status" className="rounded-xl border border-[#22A06B]/30 bg-[#EAF8F1] p-5 text-[#14532D]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-2.5 py-1 font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.1em] text-[#18794E]">
                ✓ Payment Verified · One-Time Purchase
              </div>
              <h2 className="mt-2.5 font-['Newsreader'] text-[24px] leading-tight text-[#1B1C18]">
                {formatCredits(receipt.creditsGranted)} credits added to {profile.workspaceName}
              </h2>
              <p className="mt-1 font-['Space_Grotesk'] text-[13px] text-[#264D3B]">
                New balance: <strong className="font-semibold">{formatCredits(receipt.newCreditsBalance)} credits</strong>.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-[#355E4B]">
                <span>Payment ID: {receipt.paymentId}</span>
                <span>Order ID: {receipt.orderId}</span>
              </div>
            </div>
            <Link href="/dashboard" className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-white hover:bg-[#34352F]">
              Return to Overview →
            </Link>
          </div>
        </div>
      ) : null}

      {(stage === "failed" || stage === "cancelled") && feedbackMessage ? (
        <div role="alert" className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4 ${stage === "failed" ? "border-[#EF4444]/30 bg-[#FFF1F0] text-[#991B1B]" : "border-[#E6E4DC] bg-[#F8F7F2] text-[#444748]"}`}>
          <p className="font-['Space_Grotesk'] text-[13px] leading-5">{feedbackMessage}</p>
          <button type="button" onClick={() => void handlePayNow()} className="shrink-0 rounded-lg bg-[#1B1C18] px-3.5 py-2 font-['Space_Grotesk'] text-[12px] font-semibold text-white hover:bg-[#34352F]">
            Try payment again
          </button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="grid gap-4 sm:grid-cols-2">
            {ONE_TIME_PLAN_LIST.map((plan) => {
              const isSelected = plan.id === selectedPlanId;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => handleSelectPlan(plan.id)}
                  aria-pressed={isSelected}
                  className={`relative flex flex-col justify-between rounded-2xl p-6 text-left transition-all ${isSelected ? "border-2 border-[#1B1C18] bg-[#FFFEFB] shadow-[0_12px_32px_rgba(27,28,24,0.08)]" : "border border-[#E6E4DC] bg-white hover:border-[#C9C6BA]"}`}
                >
                  <div>
                    <span className="mb-3 inline-flex w-fit rounded-full bg-[#1B1C18] px-2.5 py-1 font-['Space_Grotesk'] text-[9px] font-bold uppercase tracking-[1.4px] text-white">
                      {plan.badge || "ONE-TIME PACK"}
                    </span>
                    <h3 className="font-['Space_Grotesk'] text-[20px] font-bold text-[#1B1C18]">{plan.name}</h3>
                    <p className="mt-1.5 font-['Space_Grotesk'] text-[12.5px] leading-[1.45] text-[#747878]">{plan.description}</p>
                    <div className="mt-5 border-t border-[#ECEBE4] pt-4">
                      <div className="flex flex-wrap items-baseline gap-2">
                        {plan.originalPriceInr ? <span className="font-['Space_Grotesk'] text-[16px] font-medium text-[#8C8F8E] line-through">{formatInr(plan.originalPriceInr)}</span> : null}
                        <span className="font-['Space_Grotesk'] text-[32px] font-bold tracking-[-0.8px] text-[#1B1C18]">{formatInr(plan.priceInr)}</span>
                        <span className="font-['Space_Grotesk'] text-[12px] font-medium text-[#747878]">one-time</span>
                      </div>
                      <p className="mt-3 font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">{formatCredits(plan.credits)} credits</p>
                      <p className="font-['Space_Grotesk'] text-[12px] text-[#747878]">{plan.estimateLabel} · {plan.roughlyCalls}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="lg:col-span-5">
          <div className="rounded-2xl border border-[#E6E4DC] bg-[#FFFEFB] p-6 shadow-[0_8px_28px_rgba(27,28,24,0.04)]">
            <h2 className="font-['Space_Grotesk'] text-[12px] font-bold uppercase tracking-[0.09em] text-[#747878]">Checkout summary</h2>
            <div className="mt-4 flex items-baseline justify-between border-b border-[#ECEBE4] pb-4">
              <div>
                <p className="font-['Newsreader'] text-[26px] leading-tight text-[#1B1C18]">{selectedPlan.name} Plan</p>
                <p className="mt-0.5 font-['Space_Grotesk'] text-[12px] text-[#747878]">One-time payment · Instant credit grant</p>
              </div>
              <span className="font-['Space_Grotesk'] text-[26px] font-bold text-[#1B1C18]">{formatInr(selectedPlan.priceInr)}</span>
            </div>

            <dl className="mt-4 space-y-2.5 font-['Space_Grotesk'] text-[13px]">
              <div className="flex items-center justify-between"><dt className="text-[#666A68]">Workspace</dt><dd className="font-medium text-[#1B1C18]">{profile.workspaceName}</dd></div>
              <div className="flex items-center justify-between"><dt className="text-[#666A68]">Credits granted</dt><dd className="font-semibold text-[#1B1C18]">+{formatCredits(selectedPlan.credits)} credits</dd></div>
              <div className="flex items-center justify-between"><dt className="text-[#666A68]">Talk time estimate</dt><dd className="text-[#444748]">{selectedPlan.estimateLabel}</dd></div>
            </dl>

            <button
              type="button"
              onClick={() => void handlePayNow()}
              disabled={isBusy}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[14px] font-semibold text-white transition hover:bg-[#34352F] disabled:opacity-60"
            >
              {stage === "creating_order"
                ? "Preparing Razorpay order..."
                : stage === "checkout_open"
                  ? "Complete payment in Razorpay..."
                  : stage === "verifying"
                    ? "Verifying payment signature..."
                    : `Pay ${formatInr(selectedPlan.priceInr)} with Razorpay`}
            </button>
          </div>
        </aside>
      </div>

      <section className="rounded-2xl border border-[#E6E4DC] bg-white p-5 sm:p-6">
        <h2 className="font-['Newsreader'] text-[22px] text-[#1B1C18]">Payment history</h2>
        {billingData?.orders && billingData.orders.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[540px] border-collapse text-left font-['Space_Grotesk'] text-[12.5px]">
              <thead>
                <tr className="border-b border-[#ECEBE4] text-[10px] font-bold uppercase tracking-[0.08em] text-[#85877F]">
                  <th className="py-2.5 pr-4">Plan</th>
                  <th className="py-2.5 pr-4">Amount</th>
                  <th className="py-2.5 pr-4">Credits</th>
                  <th className="py-2.5 pr-4">Status</th>
                  <th className="py-2.5 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F2EC]">
                {billingData.orders.map((order) => (
                  <tr key={order.orderId}>
                    <td className="py-3 pr-4 font-semibold capitalize text-[#1B1C18]">{order.planName}</td>
                    <td className="py-3 pr-4 text-[#34352F]">{formatInr(order.amountInr)}</td>
                    <td className="py-3 pr-4 font-medium text-[#1B1C18]">+{formatCredits(order.creditsGranted)}</td>
                    <td className="py-3 pr-4 uppercase text-[10px] font-semibold">{order.status}</td>
                    <td className="py-3 text-right text-[#666A68]">{formatDateTime(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 font-['Space_Grotesk'] text-[12px] text-[#747878]">No one-time payments recorded yet.</p>
        )}
      </section>
    </div>
  );
}
