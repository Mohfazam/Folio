"use client";

import { useState } from "react";
import Link from "next/link";

interface PricingProps {
  currentPlan?: string | null;
}

type PlanTier = {
  id: "growth" | "pro" | "scale";
  name: string;
  originalPrice?: string;
  price: string;
  period: string;
  description: string;
  roughlyCalls: string;
  maxRecommendedCalls: number;
  creditsSummary: string;
  estimateSummary: string;
  features: string[];
  featuredByDefault?: boolean;
};

const PLANS: PlanTier[] = [
  {
    id: "growth",
    name: "Growth",
    originalPrice: "₹12,000",
    price: "₹8,300",
    period: "/month",
    description: "For growing teams starting automated outbound calls.",
    roughlyCalls: "~1,000 calls / mo",
    maxRecommendedCalls: 1100,
    creditsSummary: "12,000 credits (~1 credit = 10s)",
    estimateSummary: "~2,000 min connected talk time",
    features: [
      "Custom call scripts & branching steps",
      "Automatic call quality checks",
      "Webhooks & API access",
      "Priority Slack support & onboarding",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹12,500",
    period: "/month",
    description: "For busy teams making daily sales or follow-up calls.",
    roughlyCalls: "~1,500 calls / mo",
    maxRecommendedCalls: 1650,
    creditsSummary: "18,000 credits (~1 credit = 10s)",
    estimateSummary: "~3,000 min connected talk time",
    features: [
      "Use your own outbound phone number",
      "Custom call scripts & branching steps",
      "Automatic call quality checks",
      "Webhooks & API access",
      "Priority Slack support & onboarding",
    ],
    featuredByDefault: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: "₹16,700",
    period: "/month",
    description: "For large teams with high call volume and custom routing.",
    roughlyCalls: "~2,000 calls / mo",
    maxRecommendedCalls: 99999,
    creditsSummary: "24,000 credits (~1 credit = 10s)",
    estimateSummary: "~4,000 min connected talk time",
    features: [
      "Use your own outbound phone number",
      "Dedicated phone lines & custom SIP",
      "Dedicated account manager & SLA",
      "SOC-2 Type II & HIPAA compliance",
      "Custom voice & script setup",
    ],
  },
];

export const Pricing = ({ currentPlan = null }: PricingProps) => {
  const [monthlyCalls, setMonthlyCalls] = useState<number>(1500);

  const normalizedPlan = currentPlan?.trim().toLowerCase() ?? null;
  const isOnTrial = normalizedPlan === "trial";
  const isTrialExpired = normalizedPlan === "expired";

  const recommendedTierId: "growth" | "pro" | "scale" =
    monthlyCalls <= 1100 ? "growth" : monthlyCalls <= 1650 ? "pro" : "scale";

  const estimatedMinutes = Math.round(monthlyCalls * 2);

  return (
    <section
      id="pricing"
      className="w-full border-t border-[#E9E8E1] bg-[#FBF9F2] py-20 md:py-28"
    >
      <div className="mx-auto w-full max-w-[1240px] px-6 md:px-10">
        {/* Section Header */}
        <div className="flex flex-col items-center text-center">
          <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.5px] text-[#525552]">
            TRANSPARENT PRICING
          </span>
          <h2 className="mt-4 max-w-[620px]">
            <span className="block font-['Newsreader'] text-[36px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[46px] md:text-[52px]">
              Pay only for the calls{" "}
              <span className="italic">you run.</span>
            </span>
          </h2>
          <p className="mt-4 max-w-[56ch] font-['Space_Grotesk'] text-[14.5px] font-normal leading-[23px] tracking-[0.1px] text-[#525552] md:text-[15px]">
            Simple credit billing (~1 credit = 10 seconds of talk time). Pay only for the calls you run, with no hidden fees.
          </p>
        </div>

        {/* Interactive Call Volume Estimator */}
        <div className="mx-auto mt-10 max-w-[780px] rounded-2xl border border-[#E3DFD3] bg-white p-5 shadow-[0_4px_20px_rgba(27,28,24,0.03)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <label
                htmlFor="monthly-call-slider"
                className="font-['Space_Grotesk'] text-[12px] font-bold uppercase tracking-[0.8px] text-[#525552]"
              >
                How many calls do you make per month?
              </label>
              <p className="mt-1 font-['Space_Grotesk'] text-[13px] text-[#525552] tabular-nums">
                About ~{estimatedMinutes.toLocaleString("en-IN")} minutes of talk time · Best plan:{" "}
                <span className="font-bold text-[#1B1C18] capitalize">{recommendedTierId}</span>
              </p>
            </div>

            <span className="rounded-xl bg-[#F5F3EC] px-3.5 py-1.5 font-['Space_Grotesk'] text-[16px] font-bold text-[#1B1C18] tabular-nums">
              {monthlyCalls.toLocaleString("en-IN")} calls/mo
            </span>
          </div>

          <input
            id="monthly-call-slider"
            type="range"
            min={300}
            max={2400}
            step={100}
            value={monthlyCalls}
            onChange={(e) => setMonthlyCalls(Number(e.target.value))}
            className="mt-4 h-2 w-full cursor-pointer accent-[#1B1C18]"
          />

          <div className="mt-2 flex justify-between font-['Space_Grotesk'] text-[11px] text-[#525552] tabular-nums">
            <span>300 calls</span>
            <span>~1,000 (Growth)</span>
            <span>~1,500 (Pro)</span>
            <span>2,400+ calls</span>
          </div>
        </div>

        {/* 3 Pricing Cards */}
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const isRecommendedFit = plan.id === recommendedTierId;
            const isElevated = plan.id === "pro" || isRecommendedFit;

            return (
              <div
                key={plan.name}
                className={`relative flex w-full flex-col justify-between rounded-2xl p-7 transition-all duration-200 ${
                  isElevated
                    ? "border-2 border-[#1B1C18] bg-white shadow-[0_14px_40px_rgba(27,28,24,0.08)]"
                    : "border border-[#E3DFD3] bg-white shadow-[0_4px_20px_rgba(27,28,24,0.03)]"
                }`}
              >
                {(plan.featuredByDefault || isRecommendedFit) && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span
                      className={`whitespace-nowrap rounded-full px-3 py-1 font-['Space_Grotesk'] text-[9.5px] font-bold uppercase tracking-[1.4px] shadow-xs ${
                        isRecommendedFit
                          ? "bg-[#FD7032] text-white"
                          : "bg-[#1B1C18] text-white"
                      }`}
                    >
                      {isRecommendedFit ? "BEST FIT FOR YOU" : "RECOMMENDED"}
                    </span>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-['Space_Grotesk'] text-[20px] font-bold text-[#1B1C18]">
                      {plan.name}
                    </h3>
                    <span className="rounded-md bg-[#F5F3EC] px-2.5 py-1 font-['Space_Grotesk'] text-[11px] font-bold text-[#1B1C18] tabular-nums">
                      {plan.roughlyCalls}
                    </span>
                  </div>

                  <p className="mt-2 min-h-[44px] font-['Space_Grotesk'] text-[13px] leading-[1.5] text-[#525552]">
                    {plan.description}
                  </p>

                  <div className="my-6 border-t border-[#E9E8E1] pt-6">
                    <div className="flex flex-wrap items-baseline gap-2">
                      {plan.originalPrice && (
                        <span className="font-['Space_Grotesk'] text-[19px] font-medium text-[#6C706E] line-through tabular-nums">
                          {plan.originalPrice}
                        </span>
                      )}
                      <div className="flex items-baseline gap-1">
                        <span className="font-['Space_Grotesk'] text-[38px] font-bold tracking-[-1px] text-[#1B1C18] tabular-nums">
                          {plan.price}
                        </span>
                        <span className="font-['Space_Grotesk'] text-[13px] font-medium text-[#525552]">
                          {plan.period}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3.5 flex flex-col gap-1">
                      <span className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] tabular-nums">
                        {plan.creditsSummary}
                      </span>
                      <span className="font-['Space_Grotesk'] text-[12px] text-[#525552] tabular-nums">
                        {plan.estimateSummary}
                      </span>
                    </div>
                  </div>

                  {/* De-duplicated capabilities list */}
                  <ul className="flex flex-col gap-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E3FCEF] text-[10px] font-bold text-[#166534]">
                          ✓
                        </span>
                        <span className="font-['Space_Grotesk'] text-[13px] leading-[1.45] text-[#2D2F2B]">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 pt-4">
                  {currentPlan ? (
                    <Link
                      href={`/dashboard/billing?plan=${plan.name.toLowerCase()}`}
                      className="block w-full"
                    >
                      <button
                        type="button"
                        className={`flex h-11 w-full items-center justify-center rounded-xl font-['Space_Grotesk'] text-[13px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2 ${
                          isElevated
                            ? "bg-[#1B1C18] text-white hover:bg-[#34352F]"
                            : "border border-[#DCD8CC] bg-[#F5F3EC] text-[#1B1C18] hover:bg-[#E9E8E1]"
                        }`}
                      >
                        {normalizedPlan === plan.name.toLowerCase()
                          ? `Buy More ${plan.name} Credits`
                          : `Upgrade to ${plan.name}`}
                      </button>
                    </Link>
                  ) : (
                    <Link
                      href={`/sign-in?redirect=${encodeURIComponent(`/dashboard/billing?plan=${plan.name.toLowerCase()}`)}`}
                      className="block w-full"
                    >
                      <button
                        type="button"
                        className={`flex h-11 w-full items-center justify-center rounded-xl font-['Space_Grotesk'] text-[13px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2 ${
                          isElevated
                            ? "bg-[#1B1C18] text-white hover:bg-[#34352F]"
                            : "border border-[#DCD8CC] bg-[#F5F3EC] text-[#1B1C18] hover:bg-[#E9E8E1]"
                        }`}
                      >
                        Sign in to buy {plan.name}
                      </button>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Free Trial / Expired Trial status box below paid cards */}
        {(isOnTrial || isTrialExpired) && (
          <div
            role="status"
            className={`mt-8 flex flex-col justify-between gap-4 rounded-2xl border p-6 shadow-[0_4px_20px_rgba(27,28,24,0.03)] sm:flex-row sm:items-center ${
              isTrialExpired
                ? "border-[#FECACA] bg-[#FEF2F2]"
                : "border-[#E2D9F8] bg-white"
            }`}
          >
            <div className="flex items-start gap-3.5">
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-['Space_Grotesk'] text-[13px] font-bold ${
                  isTrialExpired
                    ? "bg-[#FEE2E2] text-[#991B1B]"
                    : "bg-[#EFEAFB] text-[#644ABB]"
                }`}
              >
                {isTrialExpired ? "!" : "★"}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[1px] ${
                      isTrialExpired
                        ? "bg-[#FEE2E2] text-[#991B1B]"
                        : "bg-[#EFEAFB] text-[#644ABB]"
                    }`}
                  >
                    {isTrialExpired ? "Trial Expired" : "Current Plan · Free Trial"}
                  </span>
                  <span className="font-['Space_Grotesk'] text-[12px] font-medium text-[#525552] tabular-nums">
                    360 credits · ~60 min talk time (~30 calls)
                  </span>
                </div>
                <p className="mt-1.5 font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">
                  {isTrialExpired
                    ? "Your free trial has ended."
                    : "You are currently on the Free Trial plan."}
                </p>
                <p className="mt-0.5 font-['Space_Grotesk'] text-[13px] text-[#525552]">
                  Upgrade to{" "}
                  <span className="font-semibold text-[#1B1C18]">Pro</span> (18,000 credits/mo) or another plan above to unlock full production calling, your own outbound number, QA grading, and webhooks.
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/billing?plan=pro"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-[#34352F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2"
            >
              Upgrade to Pro →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
};
