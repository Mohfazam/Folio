import Link from "next/link";
import { AuthRedirectButton } from "@/components/ui/AuthRedirectButton";

interface PricingProps {
    currentPlan?: string | null; 
}

export const Pricing = ({ currentPlan = null }: PricingProps) => {
    const plans = [
        {
            name: "Trial",
            price: "Free",
            period: "",
            description: "Test the platform and validate your first automated voice workflows.",
            credits: "360 credits",
            estimate: "60 min connected talk time",
            effectiveRate: "n/a",
            roughlyCalls: "~30 calls",
            features: [
                "360 included credits",
                "60 minutes of connected talk time",
                "1 credit = 10 seconds of conversation",
                "Standard voice agents",
                "Community support",
            ],
            cta: "Start for free",
            highlighted: false,
        },
        {
            name: "Starter",
            price: "₹4,200",
            period: "/month",
            description: "For small teams validating outbound & inbound AI voice operations.",
            credits: "6,000 credits",
            estimate: "1,000 min (16h 40m)",
            effectiveRate: "₹4.20/min",
            roughlyCalls: "~500 calls",
            features: [
                "6,000 included credits",
                "1,000 minutes of connected talk time",
                "1 credit = 10 seconds of conversation",
                "Finite state machine builder",
                "Standard CRM sync (HubSpot, Salesforce)",
                "Email support (24hr SLA)",
            ],
            cta: "Start 7-day trial",
            highlighted: false,
        },
        {
            name: "Growth",
            badge: "RECOMMENDED",
            price: "₹8,300",
            period: "/month",
            description: "For scaling teams that require high-throughput voice operations.",
            credits: "12,000 credits",
            estimate: "2,000 min (33h 20m)",
            effectiveRate: "₹4.15/min",
            roughlyCalls: "~1,000 calls",
            features: [
                "12,000 included credits",
                "2,000 minutes of connected talk time",
                "1 credit = 10 seconds of conversation",
                "Advanced state machine & branching",
                "Real-time automated QA grading",
                "Custom webhooks & API access",
                "Priority Slack support & onboarding",
            ],
            cta: "Start 7-day trial",
            highlighted: true,
        },
        {
            name: "Pro",
            price: "₹12,500",
            period: "/month",
            description: "For established teams managing high-volume outbound operations.",
            credits: "18,000 credits",
            estimate: "3,000 min (50h)",
            effectiveRate: "₹4.17/min",
            roughlyCalls: "~1,500 calls",
            features: [
                "18,000 included credits",
                "3,000 minutes of connected talk time",
                "1 credit = 10 seconds of conversation",
                "Advanced state machine & branching",
                "Real-time automated QA grading",
                "Custom webhooks & API access",
                "Priority Slack support & onboarding",
            ],
            cta: "Start 7-day trial",
            highlighted: false,
        },
        {
            name: "Scale",
            price: "₹16,700",
            period: "/month",
            description: "For operations with maximum volume and custom routing requirements.",
            credits: "24,000 credits",
            estimate: "4,000 min (66h 40m)",
            effectiveRate: "₹4.18/min",
            roughlyCalls: "~2,000 calls",
            features: [
                "24,000 included credits",
                "4,000 minutes of connected talk time",
                "1 credit = 10 seconds of conversation",
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
                        Fair and transparent pricing that scales with your team. You pay in credits — not fixed minutes — so talk time flexes with real usage. No hidden platform surcharges or surprise overages.
                    </p>
                </div>

                <div className="mt-14 flex flex-wrap justify-center gap-6">
                    {plans.map((plan) => (
                        <div
                            key={plan.name}
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
                                    <div className="flex items-baseline gap-1">
                                        <span className="font-['Space_Grotesk'] text-[38px] font-bold text-[#1B1C18] tracking-[-1px]">
                                            {plan.price}
                                        </span>
                                        <span className="font-['Space_Grotesk'] text-[13px] font-medium text-[#747878]">
                                            {plan.period}
                                        </span>
                                    </div>

                                    <div className="mt-4 flex flex-col gap-1.5">
                                        <span className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                                            {plan.credits}
                                        </span>
                                        <span className="font-['Space_Grotesk'] text-[12px] text-[#747878]">
                                            {plan.estimate}
                                        </span>
                                        
                                        <div className="mt-2 flex items-center gap-2">
                                            <div className="flex flex-1 items-center justify-between rounded-lg border border-[#EAE6DC] bg-[#FBF9F2] px-2.5 py-1.5">
                                                <span className="font-['Space_Grotesk'] text-[10px] font-medium text-[#747878]">Rate</span>
                                                <span className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#1B1C18]">{plan.effectiveRate}</span>
                                            </div>
                                            <div className="flex flex-1 items-center justify-between rounded-lg border border-[#EAE6DC] bg-[#FBF9F2] px-2.5 py-1.5">
                                                <span className="font-['Space_Grotesk'] text-[10px] font-medium text-[#747878]">Vol</span>
                                                <span className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#1B1C18]">{plan.roughlyCalls}</span>
                                            </div>
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
                                {plan.name === "Scale" ? (
                                    <a
                                        href="mailto:sales@foolioo.app?subject=Scale%20Plan%20Inquiry"
                                        className="flex h-11 w-full items-center justify-center rounded-xl border border-[#E9E8E1] bg-[#F5F3EC] font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] transition-colors duration-200 hover:bg-[#E9E8E1]"
                                    >
                                        Contact sales
                                    </a>
                                ) : currentPlan?.toLowerCase() === plan.name.toLowerCase() ? (
                                    <button
                                        disabled
                                        className="flex h-11 w-full cursor-not-allowed items-center justify-center rounded-xl border border-[#E9E8E1] bg-[#F5F3EC] font-['Space_Grotesk'] text-[13px] font-semibold text-[#A0A09E]"
                                    >
                                        Current Plan
                                    </button>
                                ) : currentPlan ? (
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