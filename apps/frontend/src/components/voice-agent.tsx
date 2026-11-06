import Link from "next/link";
import { ComingSoonButton } from "@/components/ui/ComingSoon";
import { AuthRedirectButton } from "@/components/ui/AuthRedirectButton";

export const VoiceAgent = () => {
    return (
        <section className="w-full border-t border-[#E9E8E1] bg-[#FBF9F2] py-20 md:py-28">
            <div className="mx-auto w-full max-w-[1240px] px-6 md:px-10">
                <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
                    {/* Left Column: Interactive State Machine & Rule Builder Mockup */}
                    <div className="overflow-hidden rounded-xl border border-[#E9E8E1] bg-white shadow-[0px_8px_30px_rgba(0,0,0,0.06)] lg:col-span-7">
                        {/* Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9E8E1] bg-[#FAFAF8] p-5">
                            <div>
                                <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                                    Agenda: Inbound Logistics Qualification
                                </p>
                                <p className="font-['Space_Grotesk'] text-[11px] text-[#747878]">
                                    Deterministic State Machine • v2.4 (Active)
                                </p>
                            </div>
                            <span className="flex items-center gap-1.5 rounded-full bg-[#E3FCEF] px-2.5 py-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#22A06B]">
                                Strict Mode: Locked
                            </span>
                        </div>

                        {/* Rules & Logic Tree */}
                        <div className="flex flex-col gap-4 p-5 sm:p-6">
                            {/* Node 1 */}
                            <div className="rounded-lg border border-[#E9E8E1] bg-[#FCFBF8] p-4 shadow-2xs">
                                <div className="flex items-center justify-between">
                                    <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[0.5px] text-[#1B1C18]">
                                        01. Identity & Consent Verification
                                    </span>
                                    <span className="rounded bg-[#E9E8E1] px-1.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-medium text-[#444748]">
                                        Mandatory Step
                                    </span>
                                </div>
                                <p className="mt-2 font-['Space_Grotesk'] text-[12px] leading-[18px] text-[#747878]">
                                    Verify caller legal name and record affirmative TCPA consent prior to discussing confidential account information.
                                </p>
                            </div>

                            {/* Branch Connector */}
                            <div className="flex items-center gap-2 pl-4">
                                <div className="h-6 w-0.5 bg-[#E9E8E1]"></div>
                                <span className="rounded bg-[#F5F3EC] px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold text-[#747878]">
                                    IF consent == TRUE → Step 02 | ELSE terminate_call()
                                </span>
                            </div>

                            {/* Node 2 */}
                            <div className="rounded-lg border border-[#E9E8E1] bg-[#FCFBF8] p-4 shadow-2xs">
                                <div className="flex items-center justify-between">
                                    <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[0.5px] text-[#1B1C18]">
                                        02. Budget & Move-in Qualification
                                    </span>
                                    <span className="rounded bg-[#E3FCEF] px-1.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold text-[#22A06B]">
                                        Condition: Budget &ge; ₹3,500
                                    </span>
                                </div>
                                <p className="mt-2 font-['Space_Grotesk'] text-[12px] leading-[18px] text-[#747878]">
                                    Check monthly budget and move-in timeline (&lt; 45 days). If criteria are met, trigger automated calendar invite dispatch.
                                </p>
                            </div>

                            {/* Guardrail alert */}
                            <div className="flex items-start gap-2.5 rounded-lg border border-[#F59E0B]/30 bg-[#FEF3C7]/40 p-3">
                                <span className="text-[13px]">🛡️</span>
                                <div>
                                    <p className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#92400E]">
                                        Deterministic Guardrail Active
                                    </p>
                                    <p className="font-['Space_Grotesk'] text-[11px] text-[#B45309]">
                                        Zero negotiation on security deposits or lease terms allowed without explicit webhook supervisor authorization.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Bottom Action Footer */}
                        <div className="flex items-center justify-between border-t border-[#E9E8E1] bg-[#FAFAF8] px-5 py-3.5">
                            <span className="font-['Space_Grotesk'] text-[11px] text-[#747878]">
                                12 Test cases passed • 0 Hallucinations detected
                            </span>
                            
                            {/* Wrapped in Link to route to /live-demo */}
                            <Link href="/live-demo">
                                <ComingSoonButton className="rounded bg-[#1B1C18] px-3 py-1.5 font-['Space_Grotesk'] text-[11px] font-medium text-white transition-colors hover:bg-[#3A3B37]">
                                    Simulate Agent
                                </ComingSoonButton>
                            </Link>
                        </div>
                    </div>

                    {/* Right Column: Text content */}
                    <div className="flex flex-col lg:col-span-5">
                        <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.5px] text-[#747878]">
                            DETERMINISTIC AGENTS
                        </span>

                        <h2 className="mt-4">
                            <span className="block font-['Newsreader'] text-[36px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[44px]">
                                The voice agent that
                            </span>
                            <span className="block font-['Newsreader'] text-[36px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[44px]">
                                follows your rules.{" "}
                                <span className="italic">Every time.</span>
                            </span>
                        </h2>

                        <p className="mt-5 font-['Space_Grotesk'] text-[15px] font-normal leading-[24px] tracking-[0.1px] text-[#747878]">
                            No hallucinations. No off-script moments. Build deterministic conversation flows that handle every scenario exactly the way you define—with branching logic, fallback responses, and guardrails baked in.
                        </p>

                        {/* Bullets */}
                        <div className="mt-8 flex flex-col gap-4">
                            {[
                                "Finite state machines guarantee 100% adherence to your approved script.",
                                "Real-time compliance monitoring rejects off-topic or hallucinated statements.",
                                "Seamless human supervisor takeover triggered on specific sentiment flags.",
                            ].map((bullet, idx) => (
                                <div key={idx} className="flex items-start gap-3">
                                    <div className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1B1C18] text-[9px] text-white">
                                        ✓
                                    </div>
                                    <p className="font-['Space_Grotesk'] text-[13px] font-medium leading-[20px] text-[#444748]">
                                        {bullet}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-8">
                            <AuthRedirectButton className="inline-flex items-center gap-1.5 font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] transition hover:gap-2.5">
                                <span>Build an AI agent today</span>
                                <span>→</span>
                            </AuthRedirectButton>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};