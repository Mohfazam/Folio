import Link from "next/link";
import { ComingSoonButton } from "@/components/ui/ComingSoon";

// Accept the isLoggedIn prop
export const OutboundCalls = ({ isLoggedIn = false }: { isLoggedIn?: boolean }) => {
    return (
        <section className="w-full border-t border-[#E9E8E1] bg-[#FBF9F2] py-20 md:py-28">
            <div className="mx-auto w-full max-w-[1240px] px-6 md:px-10">
                <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
                    {/* Left text column */}
                    <div className="flex flex-col lg:col-span-5">
                        <div className="inline-flex items-center gap-2">
                            <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.5px] text-[#747878]">
                                OUTBOUND CAMPAIGNS
                            </span>
                        </div>

                        <h2 className="mt-4">
                            <span className="block font-['Newsreader'] text-[36px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[44px]">
                                Foolioo runs your outbound
                            </span>
                            <span className="block font-['Newsreader'] text-[36px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[44px]">
                                calls{" "}
                                <span className="italic">with human poise.</span>
                            </span>
                        </h2>

                        <p className="mt-5 font-['Space_Grotesk'] text-[15px] font-normal leading-[24px] tracking-[0.1px] text-[#747878]">
                            Upload a list. Set the rules. Foolioo calls each contact with natural, context-aware conversation—handling objections, answering questions, and booking meetings without human intervention.
                        </p>

                        {/* Feature bullets */}
                        <div className="mt-8 flex flex-col gap-4">
                            {[
                                "Parallel dialing across time zones with automated local presence caller ID.",
                                "Sub-second latency and natural interruption recovery that feels indistinguishable from human.",
                                "Real-time automated disposition logging, recording sync, and bidirectional CRM updates.",
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
                            {/* Wrap the button in a Next.js Link */}
                            <Link 
                                href={isLoggedIn ? "/dashboard/campaigns" : "/sign-up"} 
                                className="inline-block"
                            >
                                <ComingSoonButton className="inline-flex items-center gap-1.5 font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] transition hover:gap-2.5">
                                    <span>Explore Campaigns feature</span>
                                    <span>→</span>
                                </ComingSoonButton>
                            </Link>
                        </div>
                    </div>

                    {/* Right column: Outbound dialer campaign UI */}
                    <div className="overflow-hidden rounded-xl border border-[#E9E8E1] bg-white shadow-[0px_8px_30px_rgba(0,0,0,0.06)] lg:col-span-7">
                        {/* Dialer Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9E8E1] bg-[#FAFAF8] p-5">
                            <div>
                                <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                                    Active Campaign • Q4 Renewal Outreach
                                </p>
                                <p className="font-['Space_Grotesk'] text-[11px] text-[#747878]">
                                    Strategy: Tier 1 Priority • 4 lines concurrent
                                </p>
                            </div>
                            <span className="flex items-center gap-1.5 rounded-full bg-[#E3FCEF] px-2.5 py-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#22A06B]">
                                <span className="h-2 w-2 animate-pulse rounded-full bg-[#22A06B]"></span>
                                Live • 4 Lines Active
                            </span>
                        </div>

                        {/* Progress Stats Bar */}
                        <div className="border-b border-[#E9E8E1] bg-[#FCFBF8] p-5">
                            <div className="flex items-center justify-between font-['Space_Grotesk'] text-[11px] font-medium text-[#747878]">
                                <span>142 of 200 Dialed (71%)</span>
                                <span className="text-[#1B1C18]">89 Connected (62.6%)</span>
                            </div>
                            <div className="mt-2.5 flex h-2 w-full overflow-hidden rounded-full bg-[#E9E8E1]">
                                <div className="h-full w-[62%] bg-[#1B1C18]"></div>
                                <div className="h-full w-[18%] bg-[#8B5CF6]"></div>
                                <div className="h-full w-[10%] bg-[#22A06B]"></div>
                            </div>
                        </div>

                        {/* Calls Table / List */}
                        <div className="divide-y divide-[#E9E8E1]">
                            {/* Row 1 */}
                            <div className="flex items-center justify-between p-4 transition hover:bg-[#FAFAF8]">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E9E8E1] font-['Space_Grotesk'] text-[11px] font-bold text-[#1B1C18]">
                                        AK
                                    </div>
                                    <div>
                                        <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                                            Arjun Kapoor • +91 98201 45019
                                        </p>
                                        <p className="font-['Space_Grotesk'] text-[11px] text-[#747878]">
                                            Acme Logistics • Duration: 02:14
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    {/* Mini Animated Waveform */}
                                    <div className="hidden items-center gap-0.5 sm:flex">
                                        <span className="h-2 w-0.5 animate-pulse bg-[#22A06B]"></span>
                                        <span className="h-4 w-0.5 animate-pulse bg-[#22A06B] delay-75"></span>
                                        <span className="h-3 w-0.5 animate-pulse bg-[#22A06B] delay-150"></span>
                                        <span className="h-5 w-0.5 animate-pulse bg-[#22A06B]"></span>
                                        <span className="h-2 w-0.5 animate-pulse bg-[#22A06B] delay-100"></span>
                                    </div>
                                    <span className="rounded bg-[#E3FCEF] px-2 py-0.5 font-['Space_Grotesk'] text-[11px] font-medium text-[#22A06B]">
                                        Connected
                                    </span>
                                </div>
                            </div>

                            {/* Row 2 */}
                            <div className="flex items-center justify-between p-4 transition hover:bg-[#FAFAF8]">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E9E8E1] font-['Space_Grotesk'] text-[11px] font-bold text-[#1B1C18]">
                                        RM
                                    </div>
                                    <div>
                                        <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                                            Rohan Mehta • +91 99300 27184
                                        </p>
                                        <p className="font-['Space_Grotesk'] text-[11px] text-[#747878]">
                                            Apex Healthcare • Ringing (12s)
                                        </p>
                                    </div>
                                </div>

                                <span className="rounded bg-[#EDE9FE] px-2 py-0.5 font-['Space_Grotesk'] text-[11px] font-medium text-[#6D28D9]">
                                    Dialing...
                                </span>
                            </div>

                            {/* Row 3 */}
                            <div className="flex items-center justify-between p-4 transition hover:bg-[#FAFAF8]">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E9E8E1] font-['Space_Grotesk'] text-[11px] font-bold text-[#1B1C18]">
                                        PS
                                    </div>
                                    <div>
                                        <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                                            Priya Sharma • +91 98450 61237
                                        </p>
                                        <p className="font-['Space_Grotesk'] text-[11px] text-[#747878]">
                                            Summit Media • Call completed
                                        </p>
                                    </div>
                                </div>

                                <span className="rounded bg-[#E3FCEF] px-2 py-0.5 font-['Space_Grotesk'] text-[11px] font-medium text-[#22A06B]">
                                    Meeting Booked
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};