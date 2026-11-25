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
      "12,000 included credits",
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
      "18,000 included credits",
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
  scale: {
    id: "scale",
    name: "Scale",
    priceInr: 16700,
    amountPaise: 1670000,
    credits: 24000,
    estimateLabel: "~4,000 min (66h 40m)",
    roughlyCalls: "~2,000 calls",
    description: "For operations with maximum volume and custom routing requirements.",
    features: [
      "24,000 included credits",
      "~4,000 minutes of connected talk time",
      "~1 credit = 10 seconds of conversation",
      "Use your own phone number for outbound calls",
      "Dedicated carrier trunking & BYO SIP",
      "Dedicated account manager & SLA",
      "SOC-2 Type II & HIPAA compliance",
      "Custom LLM fine-tuning & deployment",
    ],
    highlighted: false,
  },
  dev_test: {
    id: "dev_test",
    name: "Dev Test",
    badge: "LOCALHOST ONLY",
    priceInr: 5,
    amountPaise: 500,
    credits: 1,
    estimateLabel: "~10 sec",
    roughlyCalls: "~1 test call",
    description: "A ₹5 localhost-only plan for validating Razorpay checkout and verification.",
    features: [
      "Localhost checkout test",
      "Payment verification test",
      "Hidden outside localhost development",
    ],
    highlighted: false,
  },
};

export const ONE_TIME_PLAN_LIST: OneTimePlanDefinition[] = [
  ONE_TIME_PLANS.growth,
  ONE_TIME_PLANS.pro,
  ONE_TIME_PLANS.scale,
];

export function isPurchasablePlanId(value: string | null | undefined): value is PurchasablePlanId {
  if (!value) return false;
  const cleaned = value.trim().toLowerCase();
  return cleaned === "growth" || cleaned === "pro" || cleaned === "scale" || cleaned === "dev_test";
}

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
  if (isPurchasablePlanId(normalized)) {
    return `/dashboard/billing?plan=${encodeURIComponent(normalized)}`;
  }
  return "/dashboard/billing";
}
