import Link from "next/link";
import { AuthRedirectButton } from "@/components/ui/AuthRedirectButton";

interface PricingProps {
    currentPlan?: string | null;
}

interface PricingPlan {
    tier: "trial" | "starter" | "growth" | "pro" | "scale";
    name: string;
    badge?: string;
    originalPrice?: string;
    price: string;
    period: string;
    description: string;
    credits: string;
    creditsDisplay: string;
    talkTime: string;
    approxCalls: string;
    features: string[];
    cta: string;
    highlighted: boolean;
}

export const Pricing = ({ currentPlan = null }: PricingProps) => {
    const plans: PricingPlan[] = [
        {
            tier: "trial",
            name: "Trial",
            price: "Free",
            period: "",
            description: "Test the platform and validate your first automated voice workflows.",
            credits: "360 credits",
            creditsDisplay: "360",
            talkTime: "~60 min",
            approxCalls: "~30",
            features: [
                "360 included credits",
                "~60 minutes of connected talk time",
                "~1 credit = 10 seconds of conversation",
                "Standard voice agents",
                "Community support",
            ],
            cta: "Start for free",
            highlighted: false,
        },
        {
            tier: "starter",
            name: "Starter",
            originalPrice: "₹6,000",
            price: "₹4,200",
            period: "/month",
            description: "For small teams validating outbound & inbound AI voice operations.",
            credits: "6,000 credits",
            creditsDisplay: "6,000",
            talkTime: "~1,000 min (16h 40m)",
            approxCalls: "~500",
            features: [
                "6,000 included credits",
                "~1,000 minutes of connected talk time",
                "~1 credit = 10 seconds of conversation",
                "Finite state machine builder",
                "Standard CRM sync (HubSpot, Salesforce)",
                "Email support (24hr SLA)",
            ],
            cta: "Start 7-day trial",
            highlighted: false,
        },
        {
            tier: "growth",
            name: "Growth",
            badge: "RECOMMENDED",
            originalPrice: "₹12,000",
            price: "₹8,300",
            period: "/month",
            description: "For scaling teams that require high-throughput voice operations.",
            credits: "12,000 credits",
            creditsDisplay: "12,000",
            talkTime: "~2,000 min (33h 20m)",
            approxCalls: "~1,000",
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
            highlighted: true,
        },
        {
            tier: "pro",
            name: "Pro",
            price: "₹12,500",
            period: "/month",
            description: "For established teams managing high-volume outbound operations.",
            credits: "18,000 credits",
            creditsDisplay: "18,000",
            talkTime: "~3,000 min (50h)",
            approxCalls: "~1,500",
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
            highlighted: false,
        },
        {
            tier: "scale",
            name: "Scale",
            price: "₹16,700",
            period: "/month",
            description: "For operations with maximum volume and custom routing requirements.",
            credits: "24,000 credits",
            creditsDisplay: "24,000",
            talkTime: "~4,000 min (66h 40m)",
            approxCalls: "~2,000",
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

                {/* Plan Comparison Table */}
                <div className="mt-12 overflow-hidden rounded-2xl border border-[#E9E8E1] bg-white shadow-[0px_4px_20px_rgba(0,0,0,0.03)]">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[680px] border-collapse text-left">
                            <thead>
                                <tr className="border-b border-[#E9E8E1] bg-[#F5F3EC]/70">
                                    <th className="px-6 py-4 font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1px] text-[#747878]">
                                        Plan
                                    </th>
                                    <th className="px-6 py-4 font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1px] text-[#747878]">
                                        Price / month
                                    </th>
                                    <th className="px-6 py-4 font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1px] text-[#747878]">
                                        Credits
                                    </th>
                                    <th className="px-6 py-4 font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1px] text-[#747878]">
                                        Connected talk time
                                    </th>
                                    <th className="px-6 py-4 font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1px] text-[#747878]">
                                        Approx. calls*
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E9E8E1]">
                                {plans.map((plan) => (
                                    <tr
                                        key={plan.tier}
                                        className={
                                            plan.highlighted
                                                ? "bg-[#FBF9F2]/90"
                                                : "transition-colors hover:bg-[#FBF9F2]/50"
                                        }
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2.5">
                                                <span className="font-['Space_Grotesk'] text-[14px] font-bold text-[#1B1C18]">
                                                    {plan.name}
                                                </span>
                                                {plan.badge && (
                                                    <span className="rounded-full bg-[#1B1C18] px-2.5 py-0.5 font-['Space_Grotesk'] text-[9px] font-bold uppercase tracking-[1px] text-white">
                                                        {plan.badge}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-['Space_Grotesk'] text-[14px]">
                                            <div className="flex items-baseline gap-2">
                                                {plan.originalPrice && (
                                                    <span className="text-[13px] font-medium text-[#8C8F8E] line-through">
                                                        {plan.originalPrice}
                                                    </span>
                                                )}
                                                <span className="font-bold text-[#1B1C18]">
                                                    {plan.price}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">
                                            {plan.creditsDisplay}
                                        </td>
                                        <td className="px-6 py-4 font-['Space_Grotesk'] text-[14px] text-[#444748]">
                                            {plan.talkTime}
                                        </td>
                                        <td className="px-6 py-4 font-['Space_Grotesk'] text-[14px] font-medium text-[#444748]">
                                            {plan.approxCalls}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="border-t border-[#E9E8E1] bg-[#FBF9F2] px-6 py-3">
                        <p className="font-['Space_Grotesk'] text-[12px] text-[#747878]">
                            *Estimates assume ~1 credit = 10 secs of connected talk time and an average call duration of ~2 minutes (~12 credits/call). Actual usage varies by call length.
                        </p>
                    </div>
                </div>

                {/* Plan Cards */}
                <div className="mt-12 flex flex-wrap justify-center gap-6">
                    {plans.map((plan) => (
                        <div
                            key={plan.tier}
                            className={`relative flex w-full flex-col justify-between rounded-2xl p-7 transition duration-200 sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] ${
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
                                            {plan.talkTime} connected talk time
                                        </span>

                                        <div className="mt-2 flex items-center justify-between rounded-lg border border-[#EAE6DC] bg-[#FBF9F2] px-3 py-1.5">
                                            <span className="font-['Space_Grotesk'] text-[11px] font-medium text-[#747878]">
                                                Approx. call volume
                                            </span>
                                            <span className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">
                                                {plan.approxCalls} calls
                                            </span>
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
                                ) :

                                /* 2. Expired Trial State */
                                currentPlan === "Expired" && plan.name === "Trial" ? (
                                    <Link href={`/sign-up`} className="block w-full">
                                        <button className="flex h-11 w-full items-center justify-center rounded-xl bg-[#FEE2E2] font-['Space_Grotesk'] text-[13px] font-semibold text-[#991B1B] transition-colors hover:bg-[#FECACA]">
                                            Trial Expired — Restart
                                        </button>
                                    </Link>
                                ) :

                                /* 3. User is on this plan */
                                currentPlan?.toLowerCase() === plan.tier ? (
                                    <button
                                        disabled
                                        className="flex h-11 w-full cursor-not-allowed items-center justify-center rounded-xl border border-[#E9E8E1] bg-[#F5F3EC] font-['Space_Grotesk'] text-[13px] font-semibold text-[#A0A09E]"
                                    >
                                        Current Plan
                                    </button>
                                ) :

                                /* 4. User is logged in, wants a different plan */
                                currentPlan ? (
                                    <Link href={`/dashboard/billing?plan=${plan.tier}`} className="block w-full">
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
                                ) :

                                /* 5. Fallback: Not logged in */
                                (
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
            </div>
        </section>
    );
};
