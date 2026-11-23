import Link from "next/link";
import { AuthRedirectButton } from "@/components/ui/AuthRedirectButton";

interface PricingProps {
    currentPlan?: string | null;
}

export const Pricing = ({ currentPlan = null }: PricingProps) => {
    const normalizedPlan = currentPlan?.trim().toLowerCase() ?? null;
    const isOnTrial = normalizedPlan === "trial";
    const isTrialExpired = normalizedPlan === "expired";

    const plans = [
        {
            name: "Growth",
            originalPrice: "₹12,000",
            price: "₹8,300",
            period: "/month",
            description: "For scaling teams that require high-throughput voice operations.",
            credits: "12,000 credits",
            estimate: "~2,000 min (33h 20m)",
            roughlyCalls: "~1,000 calls",
            features: [
                "12,000 included credits",
                "~2,000 minutes of connected talk time",
                "~1 credit = 10 seconds of conversation",
                "Advanced state machine & branching",
                "Real-time automated QA grading",
                "Custom webhooks & API access",
                "Priority Slack support & onboarding",
            ],
            cta: "Start 7-day trial",
            highlighted: false,
        },
        {
            name: "Pro",
            badge: "RECOMMENDED",
            price: "₹12,500",
            period: "/month",
            description: "For established teams managing high-volume outbound operations.",
            credits: "18,000 credits",
            estimate: "~3,000 min (50h)",
            roughlyCalls: "~1,500 calls",
            features: [
                "18,000 included credits",
                "~3,000 minutes of connected talk time",
                "~1 credit = 10 seconds of conversation",
                "Advanced state machine & branching",
                "Real-time automated QA grading",
                "Custom webhooks & API access",
                "Priority Slack support & onboarding",
            ],
            cta: "Start 7-day trial",
            highlighted: true,
        },
        {
            name: "Scale",
            price: "₹16,700",
            period: "/month",
            description: "For operations with maximum volume and custom routing requirements.",
            credits: "24,000 credits",
            estimate: "~4,000 min (66h 40m)",
            roughlyCalls: "~2,000 calls",
            features: [
                "24,000 included credits",
                "~4,000 minutes of connected talk time",
                "~1 credit = 10 seconds of conversation",
                "Dedicated carrier trunking & BYO SIP",
                "Dedicated account manager & SLA",
                "SOC-2 Type II & HIPAA compliance",
                "Custom LLM fine-tuning & deployment",
            ],
            cta: "Contact sales",
            highlighted: false,
        },
    ];

    return (
        <section id="pricing" className="w-full border-t border-[#E9E8E1] bg-[#FBF9F2] py-20 md:py-28">
            <div className="mx-auto w-full max-w-[1240px] px-6 md:px-10">
                <div className="flex flex-col items-center text-center">
                    <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.5px] text-[#747878]">
                        TRANSPARENT PRICING
                    </span>
                    <h2 className="mt-4 max-w-[620px]">
                        <span className="block font-['Newsreader'] text-[36px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[46px] md:text-[52px]">
                            Pay only for the calls{" "}
                            <span className="italic">you run.</span>
                        </span>
                    </h2>
                    <p className="mt-4 max-w-[540px] font-['Space_Grotesk'] text-[14px] font-normal leading-[22px] tracking-[0.1px] text-[#747878] md:text-[15px]">
                        Fair and transparent pricing that scales with your team. You pay in credits (~1 credit = 10 secs) — not fixed minutes — so talk time flexes with real usage. No hidden platform surcharges or surprise overages.
                    </p>
                </div>

                {/* All 3 paid cards in a single row on desktop */}
                <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
                            className={`relative flex w-full flex-col justify-between rounded-2xl p-7 transition duration-200 ${
                                plan.highlighted
                                    ? "border-2 border-[#1B1C18] bg-white shadow-[0px_16px_48px_rgba(0,0,0,0.08)]"
                                    : "border border-[#E9E8E1] bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.03)]"
                            }`}
                        >
                            {plan.badge && (
                                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                                    <span className="whitespace-nowrap rounded-full bg-[#1B1C18] px-3 py-1.5 font-['Space_Grotesk'] text-[9px] font-bold tracking-[1.5px] text-white uppercase shadow-sm">
                                        {plan.badge}
                                    </span>
                                </div>
                            )}

                            <div>
                                <h3 className="font-['Space_Grotesk'] text-[20px] font-bold text-[#1B1C18]">
                                    {plan.name}
                                </h3>
                                <p className="mt-2 min-h-[48px] font-['Space_Grotesk'] text-[13px] leading-[1.5] text-[#747878]">
                                    {plan.description}
                                </p>

                                <div className="my-6 border-t border-[#E9E8E1] pt-6">
                                    <div className="flex flex-wrap items-baseline gap-2">
                                        {plan.originalPrice && (
                                            <span className="font-['Space_Grotesk'] text-[20px] font-medium text-[#8C8F8E] line-through">
                                                {plan.originalPrice}
                                            </span>
                                        )}
                                        <div className="flex items-baseline gap-1">
                                            <span className="font-['Space_Grotesk'] text-[38px] font-bold text-[#1B1C18] tracking-[-1px]">
                                                {plan.price}
                                            </span>
                                            <span className="font-['Space_Grotesk'] text-[13px] font-medium text-[#747878]">
                                                {plan.period}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-col gap-1.5">
                                        <span className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                                            {plan.credits}
                                        </span>
                                        <span className="font-['Space_Grotesk'] text-[12px] text-[#747878]">
                                            {plan.estimate}
                                        </span>

                                        <div className="mt-2 flex items-center justify-between rounded-lg border border-[#EAE6DC] bg-[#FBF9F2] px-3 py-1.5">
                                            <span className="font-['Space_Grotesk'] text-[10px] font-medium text-[#747878]">Vol</span>
                                            <span className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#1B1C18]">{plan.roughlyCalls}</span>
                                        </div>
                                    </div>
                                </div>

                                <ul className="flex flex-col gap-3">
                                    {plan.features.map((feature, i) => (
                                        <li key={i} className="flex items-start gap-2.5">
                                            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E3FCEF] text-[10px] text-[#22A06B]">
                                                ✓
                                            </span>
                                            <span className="font-['Space_Grotesk'] text-[13px] leading-[1.4] text-[#444748]">
                                                {feature}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="mt-8 pt-4">
                                {/* 1. Scale Plan */}
                                {plan.name === "Scale" ? (
                                    <a
                                        href="mailto:sales@foolioo.app?subject=Scale%20Plan%20Inquiry"
                                        className="flex h-11 w-full items-center justify-center rounded-xl border border-[#E9E8E1] bg-[#F5F3EC] font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] transition-colors duration-200 hover:bg-[#E9E8E1]"
                                    >
                                        Contact sales
                                    </a>
                                ) : /* 2. User is currently on this paid plan */
                                normalizedPlan === plan.name.toLowerCase() ? (
                                    <button
                                        disabled
                                        className="flex h-11 w-full cursor-not-allowed items-center justify-center rounded-xl border border-[#E9E8E1] bg-[#F5F3EC] font-['Space_Grotesk'] text-[13px] font-semibold text-[#A0A09E]"
                                    >
                                        Current Plan
                                    </button>
                                ) : /* 3. User is logged in (on Trial, Expired, or another plan) */
                                currentPlan ? (
                                    <Link href={`/dashboard/billing?plan=${plan.name.toLowerCase()}`} className="block w-full">
                                        <button
                                            className={`flex h-11 w-full items-center justify-center rounded-xl font-['Space_Grotesk'] text-[13px] font-semibold transition-colors duration-200 ${
                                                plan.highlighted
                                                    ? "bg-[#1B1C18] text-white hover:bg-[#3A3B37]"
                                                    : "border border-[#E9E8E1] bg-[#F5F3EC] text-[#1B1C18] hover:bg-[#E9E8E1]"
                                            }`}
                                        >
                                            Upgrade to {plan.name}
                                        </button>
                                    </Link>
                                ) : (
                                    /* 4. Fallback: Not logged in */
                                    <Link href="/sign-up" className="block w-full">
                                        <AuthRedirectButton
                                            className={`flex h-11 w-full items-center justify-center rounded-xl font-['Space_Grotesk'] text-[13px] font-semibold transition-colors duration-200 ${
                                                plan.highlighted
                                                    ? "bg-[#1B1C18] text-white hover:bg-[#3A3B37]"
                                                    : "border border-[#E9E8E1] bg-[#F5F3EC] text-[#1B1C18] hover:bg-[#E9E8E1]"
                                            }`}
                                        >
                                            {plan.cta}
                                        </AuthRedirectButton>
                                    </Link>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Free Trial / Expired Trial status box below paid cards */}
                {(isOnTrial || isTrialExpired) && (
                    <div
                        role="status"
                        className={`mt-8 flex flex-col justify-between gap-4 rounded-2xl border p-6 shadow-[0px_4px_20px_rgba(0,0,0,0.03)] sm:flex-row sm:items-center ${
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
                                    <span className="font-['Space_Grotesk'] text-[12px] font-medium text-[#747878]">
                                        360 credits · ~60 min talk time (~30 calls)
                                    </span>
                                </div>
                                <p className="mt-1.5 font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">
                                    {isTrialExpired
                                        ? "Your free trial has ended."
                                        : "You are currently on the Free Trial plan."}
                                </p>
                                <p className="mt-0.5 font-['Space_Grotesk'] text-[13px] text-[#565B5B]">
                                    Upgrade to <span className="font-semibold text-[#1B1C18]">Pro</span> (18,000 credits/mo) or another paid plan above to unlock full production calling, QA grading, and API webhooks.
                                </p>
                            </div>
                        </div>

                        <Link
                            href="/dashboard/billing?plan=pro"
                            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-[#3A3B37]"
                        >
                            Upgrade to Pro →
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
};