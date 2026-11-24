import type { OneTimePlanDefinition, PurchasablePlanId } from "../types";

export const ONE_TIME_PLANS: Record<PurchasablePlanId, OneTimePlanDefinition> = {
  growth: {
    id: "growth",
    name: "Growth",
    originalPriceInr: 12000,
    priceInr: 8300,
    amountPaise: 830000,
    credits: 12000,
    estimateLabel: "~2,000 min (33h 20m)",
    roughlyCalls: "~1,000 calls",
    description: "For scaling teams that require high-throughput voice operations.",
    features: [
      "12,000 one-time credits added immediately",
      "~2,000 minutes of connected talk time",
      "~1 credit = 10 seconds of conversation",
      "Advanced state machine & branching",
      "Real-time automated QA grading",
      "Custom webhooks & API access",
      "Priority Slack support & onboarding",
    ],
    highlighted: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    badge: "RECOMMENDED",
    priceInr: 12500,
    amountPaise: 1250000,
    credits: 18000,
    estimateLabel: "~3,000 min (50h)",
    roughlyCalls: "~1,500 calls",
    description: "For established teams managing high-volume outbound operations.",
    features: [
      "18,000 one-time credits added immediately",
      "~3,000 minutes of connected talk time",
      "~1 credit = 10 seconds of conversation",
      "Use your own phone number for outbound calls",
      "Advanced state machine & branching",
      "Real-time automated QA grading",
      "Custom webhooks & API access",
      "Priority Slack support & onboarding",
    ],
    highlighted: true,
  },
};

export const ONE_TIME_PLAN_LIST: OneTimePlanDefinition[] = [
  ONE_TIME_PLANS.growth,
  ONE_TIME_PLANS.pro,
];

export function formatInr(amountInr: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amountInr);
}

export function formatCredits(credits: number): string {
  return new Intl.NumberFormat("en-IN").format(credits);
}

export function buildBillingPath(planId?: string | null): string {
  const normalized = planId?.trim().toLowerCase();
  if (normalized === "growth" || normalized === "pro") {
    return `/dashboard/billing?plan=${encodeURIComponent(normalized)}`;
  }
  return "/dashboard/billing";
}
