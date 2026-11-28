"use client";

import { useState } from "react";
import Link from "next/link";

interface PricingProps {
  currentPlan?: string | null;
  isLoggedIn?: boolean;
}

type PaidPlanId = "growth" | "pro" | "scale";
type PlanId = "trial" | PaidPlanId;

type PaidPlan = {
  id: PaidPlanId;
  name: string;
  originalPrice?: string;
  price: string;
  period: string;
  description: string;
  roughlyCalls: string;
  creditsSummary: string;
  estimateSummary: string;
  features: string[];
  featuredByDefault?: boolean;
};

const PAID_PLANS: PaidPlan[] = [
  {
    id: "growth",
    name: "Growth",
    originalPrice: "₹12,000",
    price: "₹8,300",
    period: "/mo",
    description: "For growing teams starting automated outbound calls.",
    roughlyCalls: "~1,000 calls",
    creditsSummary: "12,000 credits (~10s each)",
    estimateSummary: "~2,000 min of talk time",
    features: [
      "Custom call scripts & branching",
      "Automatic call quality checks",
      "Webhooks & API access",
      "Priority Slack support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹12,500",
    period: "/mo",
    description: "For busy teams making daily sales or follow-up calls.",
    roughlyCalls: "~1,500 calls",
    creditsSummary: "18,000 credits (~10s each)",
    estimateSummary: "~3,000 min of talk time",
    features: [
      "Use your own outbound number",
      "Custom call scripts & branching",
      "Automatic call quality checks",
      "Webhooks & API access",
      "Priority Slack support",
    ],
    featuredByDefault: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: "₹16,700",
    period: "/mo",
    description: "For large teams with high volume and custom routing.",
    roughlyCalls: "~2,000 calls",
    creditsSummary: "24,000 credits (~10s each)",
    estimateSummary: "~4,000 min of talk time",
    features: [
      "Use your own outbound number",
      "Dedicated lines & custom SIP",
      "Dedicated account manager",
      "SOC-2 Type II & HIPAA ready",
      "Custom voice & script setup",
    ],
  },
];

export const Pricing = ({ currentPlan = null, isLoggedIn = false }: PricingProps) => {
  const [monthlyCalls, setMonthlyCalls] = useState<number>(1500);

  const isSignedIn = isLoggedIn || Boolean(currentPlan);
  const normalizedPlan = currentPlan?.trim().toLowerCase() ?? null;
  const isOnTrial = normalizedPlan === "trial";
  const isTrialExpired = normalizedPlan === "expired";

  const recommendedTierId: PlanId =
    monthlyCalls <= 100
      ? "trial"
      : monthlyCalls <= 1100
        ? "growth"
        : monthlyCalls <= 1650
          ? "pro"
          : "scale";

  const estimatedMinutes = Math.round(monthlyCalls * 2);

  const recommendedName =
    recommendedTierId === "trial"
      ? "Free Trial"
      : PAID_PLANS.find((p) => p.id === recommendedTierId)?.name ?? "Pro";

  const isTrialHighlighted = recommendedTierId === "trial" || isOnTrial || isTrialExpired;

  return (
    <section
      id="pricing"
      className="w-full scroll-mt-20 bg-[#FBF9F2] py-20 md:py-28"
    >
      <div className="mx-auto w-full max-w-[1280px] px-6 md:px-10">
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
                <span className="font-bold text-[#1B1C18]">{recommendedName}</span>
              </p>
            </div>

            <span className="rounded-xl bg-[#F5F3EC] px-3.5 py-1.5 font-['Space_Grotesk'] text-[16px] font-bold text-[#1B1C18] tabular-nums">
              {monthlyCalls.toLocaleString("en-IN")} calls/mo
            </span>
          </div>

          <input
            id="monthly-call-slider"
            type="range"
            min={30}
            max={2400}
            step={30}
            value={monthlyCalls}
            onChange={(e) => setMonthlyCalls(Number(e.target.value))}
            className="mt-4 h-2 w-full cursor-pointer accent-[#1B1C18]"
          />

          <div className="mt-2 flex justify-between font-['Space_Grotesk'] text-[11px] text-[#525552] tabular-nums">
            <span>30 (Trial)</span>
            <span>~1,000 (Growth)</span>
            <span>~1,500 (Pro)</span>
            <span>2,400+ (Scale)</span>
          </div>
        </div>

        {/* Option B: Asymmetric 3 + 1 Split Grid (Free Trial rail on left + 3 paid plans on right) */}
        <div className="mt-12 grid grid-cols-1 gap-5 xl:grid-cols-12 xl:items-stretch">
          {/* Left Rail (3 cols on xl): Free Trial Starter Card */}
          <div
            className={`relative flex flex-col justify-between rounded-2xl p-5 xl:col-span-3 xl:p-6 transition-all duration-200 ${
              isTrialExpired
                ? "border-2 border-[#FECACA] bg-[#FEF2F2]/70 shadow-[0_4px_20px_rgba(153,27,27,0.05)]"
                : isTrialHighlighted
                  ? "border-2 border-[#1B1C18] bg-white shadow-[0_12px_32px_rgba(27,28,24,0.07)]"
                  : "border border-[#E3DFD3] bg-[#FCFBF8] shadow-[0_4px_18px_rgba(27,28,24,0.025)]"
            }`}
          >
            {(isTrialExpired || isOnTrial || recommendedTierId === "trial") && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 font-['Space_Grotesk'] text-[9px] font-bold uppercase tracking-[1.2px] shadow-xs ${
                    isTrialExpired
                      ? "bg-[#991B1B] text-white"
                      : isOnTrial
                        ? "bg-[#644ABB] text-white"
                        : "bg-[#FD7032] text-[#1B1C18]"
                  }`}
                >
                  {isTrialExpired
                    ? "TRIAL EXPIRED"
                    : isOnTrial
                      ? "CURRENT PLAN"
                      : "BEST FIT FOR YOU"}
                </span>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-['Space_Grotesk'] text-[18px] font-bold text-[#1B1C18]">
                  Free Trial
                </h3>
                <span className="rounded-md bg-[#F5F3EC] px-2 py-0.5 font-['Space_Grotesk'] text-[11px] font-bold text-[#1B1C18] tabular-nums">
                  ~30 calls
                </span>
              </div>

              <p className="mt-2 font-['Space_Grotesk'] text-[12.5px] leading-[1.45] text-[#525552]">
                {isTrialExpired
                  ? "Your trial credits are used up. Pick a monthly plan to keep calling."
                  : "Try live outbound calls first before picking a monthly plan."}
              </p>

              <div className="my-5 border-t border-[#E9E8E1] pt-5">
                <div className="flex items-baseline gap-1">
                  <span className="font-['Space_Grotesk'] text-[34px] font-bold tracking-[-0.8px] text-[#1B1C18] tabular-nums">
                    ₹0
                  </span>
                  <span className="font-['Space_Grotesk'] text-[12.5px] font-medium text-[#525552]">
                    /7 days
                  </span>
                </div>
                <div className="mt-3 flex flex-col gap-0.5">
                  <span className="font-['Space_Grotesk'] text-[12.5px] font-semibold text-[#1B1C18] tabular-nums">
                    360 included credits
                  </span>
                  <span className="font-['Space_Grotesk'] text-[11.5px] text-[#525552] tabular-nums">
                    ~60 min of talk time
                  </span>
                </div>
              </div>

              <ul className="flex flex-col gap-2.5">
                {[
                  "No credit card required",
                  "Custom call scripts & branching",
                  "Live recordings & transcripts",
                  "Instant CRM webhook sync",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E3FCEF] text-[9.5px] font-bold text-[#166534]">
                      ✓
                    </span>
                    <span className="font-['Space_Grotesk'] text-[12.5px] leading-[1.4] text-[#2D2F2B]">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-7 pt-3">
              {isSignedIn ? (
                <Link
                  href={isTrialExpired ? "/dashboard/billing?plan=pro" : "/dashboard"}
                  className="flex h-10 w-full items-center justify-center rounded-xl border border-[#DCD8CC] bg-white font-['Space_Grotesk'] text-[12.5px] font-semibold text-[#1B1C18] transition-colors duration-200 hover:bg-[#F5F3EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2"
                >
                  {isTrialExpired ? "Upgrade to Pro →" : "Go to Dashboard"}
                </Link>
              ) : (
                <Link
                  href="/sign-up"
                  className="flex h-10 w-full items-center justify-center rounded-xl border border-[#DCD8CC] bg-white font-['Space_Grotesk'] text-[12.5px] font-semibold text-[#1B1C18] transition-colors duration-200 hover:bg-[#F5F3EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2"
                >
                  Start free trial
                </Link>
              )}
            </div>
          </div>

          {/* Right Group (9 cols on xl): 3 Paid Monthly Tiers */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3 xl:col-span-9">
            {PAID_PLANS.map((plan) => {
              const isRecommendedFit = plan.id === recommendedTierId;
              const isCurrentUserPlan = normalizedPlan === plan.id;
              const isElevated = plan.id === "pro" || isRecommendedFit;

              let badgeText: string | null = null;
              let badgeTone = "bg-[#1B1C18] text-white";

              if (isCurrentUserPlan) {
                badgeText = "CURRENT PLAN";
                badgeTone = "bg-[#644ABB] text-white";
              } else if (isRecommendedFit) {
                badgeText = "BEST FIT FOR YOU";
                badgeTone = "bg-[#FD7032] text-[#1B1C18]";
              } else if (plan.featuredByDefault) {
                badgeText = "RECOMMENDED";
                badgeTone = "bg-[#1B1C18] text-white";
              }

              return (
                <div
                  key={plan.id}
                  className={`relative flex w-full flex-col justify-between rounded-2xl p-5 xl:p-6 transition-all duration-200 ${
                    isElevated
                      ? "border-2 border-[#1B1C18] bg-white shadow-[0_14px_40px_rgba(27,28,24,0.08)]"
                      : "border border-[#E3DFD3] bg-white shadow-[0_4px_20px_rgba(27,28,24,0.03)]"
                  }`}
                >
                  {badgeText && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span
                        className={`whitespace-nowrap rounded-full px-3 py-1 font-['Space_Grotesk'] text-[9.5px] font-bold uppercase tracking-[1.4px] shadow-xs ${badgeTone}`}
                      >
                        {badgeText}
                      </span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-['Space_Grotesk'] text-[19px] font-bold text-[#1B1C18]">
                        {plan.name}
                      </h3>
                      <span className="rounded-md bg-[#F5F3EC] px-2.5 py-0.5 font-['Space_Grotesk'] text-[11px] font-bold text-[#1B1C18] tabular-nums">
                        {plan.roughlyCalls}
                      </span>
                    </div>

                    <p className="mt-2 min-h-[42px] font-['Space_Grotesk'] text-[12.5px] leading-[1.45] text-[#525552]">
                      {plan.description}
                    </p>

                    <div className="my-5 border-t border-[#E9E8E1] pt-5">
                      <div className="flex flex-wrap items-baseline gap-2">
                        {plan.originalPrice && (
                          <span className="font-['Space_Grotesk'] text-[17px] font-medium text-[#6C706E] line-through tabular-nums">
                            {plan.originalPrice}
                          </span>
                        )}
                        <div className="flex items-baseline gap-1">
                          <span className="whitespace-nowrap font-['Space_Grotesk'] text-[30px] xl:text-[34px] font-bold tracking-[-0.8px] text-[#1B1C18] tabular-nums">
                            {plan.price}
                          </span>
                          <span className="font-['Space_Grotesk'] text-[12.5px] font-medium text-[#525552]">
                            {plan.period}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-col gap-0.5">
                        <span className="font-['Space_Grotesk'] text-[12.5px] font-semibold text-[#1B1C18] tabular-nums">
                          {plan.creditsSummary}
                        </span>
                        <span className="font-['Space_Grotesk'] text-[11.5px] text-[#525552] tabular-nums">
                          {plan.estimateSummary}
                        </span>
                      </div>
                    </div>

                    <ul className="flex flex-col gap-2.5">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2">
                          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E3FCEF] text-[9.5px] font-bold text-[#166534]">
                            ✓
                          </span>
                          <span className="font-['Space_Grotesk'] text-[12.5px] leading-[1.4] text-[#2D2F2B]">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-7 pt-3">
                    {isSignedIn ? (
                      <Link
                        href={`/dashboard/billing?plan=${plan.id}`}
                        className="block w-full"
                      >
                        <button
                          type="button"
                          className={`flex h-10 w-full items-center justify-center rounded-xl font-['Space_Grotesk'] text-[12.5px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2 ${
                            isElevated
                              ? "bg-[#1B1C18] text-white hover:bg-[#34352F]"
                              : "border border-[#DCD8CC] bg-[#F5F3EC] text-[#1B1C18] hover:bg-[#E9E8E1]"
                          }`}
                        >
                          {normalizedPlan === plan.id
                            ? `Buy More Credits`
                            : `Upgrade to ${plan.name}`}
                        </button>
                      </Link>
                    ) : (
                      <Link
                        href={`/sign-in?redirect=${encodeURIComponent(`/dashboard/billing?plan=${plan.id}`)}`}
                        className="block w-full"
                      >
                        <button
                          type="button"
                          className={`flex h-10 w-full items-center justify-center rounded-xl font-['Space_Grotesk'] text-[12.5px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2 ${
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
        </div>
      </div>
    </section>
  );
};
