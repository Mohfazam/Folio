"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUser } from "@/lib/supabase/auth";
import { User } from "@supabase/supabase-js";

const FOOTER_SECTIONS = [
    {
        title: "Product",
        links: [
            { label: "Dialer", href: "/product/dialer" },
            { label: "Voice Agent", href: "/product/voice-agent" },
            { label: "Real-time QA", href: "/product/real-time-qa" },
            { label: "State Machine", href: "/product/state-machine" },
            { label: "Integrations", href: "/product/integrations" },
            { label: "Pricing", href: "/#pricing" },
        ],
    },
    {
        title: "Solutions",
        links: [
            { label: "Outbound Sales", href: "/solutions/outbound-sales" },
            { label: "Inbound Support", href: "/solutions/inbound-support" },
            { label: "Property Logistics", href: "/solutions/property-logistics" },
            { label: "Healthcare", href: "/solutions/healthcare" },
            { label: "Financial Services", href: "/solutions/financial-services" },
        ],
    },
    {
        title: "Resources",
        links: [
            { label: "Documentation", href: "/docs" },
            { label: "API Reference", href: "/api-reference" },
            { label: "Compliance Guide", href: "/compliance" },
            { label: "System Status", href: "/status" },
            { label: "Security Whitepaper", href: "/security" },
        ],
    },
    {
        title: "Company",
        links: [
            { label: "About Us", href: "/about" },
            { label: "Customers", href: "/customers" },
            { label: "Careers", href: "/careers" },
            { label: "Privacy Policy", href: "/privacy" },
            { label: "Terms of Service", href: "/terms" },
        ],
    },
];

export const CtaFooter = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const getInitialUser = async () => {
            try {
                setUser(await getCurrentUser(supabase));
            } catch (error) {
                console.error("Failed to fetch user:", error);
            } finally {
                setIsLoading(false);
            }
        };

        getInitialUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setUser(session?.user ?? null);
            }
        );

        return () => subscription.unsubscribe();
    }, [supabase]);

    return (
        <section className="w-full border-t border-[#E9E8E1] bg-[#FBF9F2]">
            {/* CTA Card Container */}
            <div className="mx-auto w-full max-w-[1240px] px-6 py-20 md:px-10 md:py-28">
                <div className="relative overflow-hidden rounded-2xl border border-[#E9E8E1] bg-white p-8 text-center shadow-[0px_8px_30px_rgba(0,0,0,0.04)] md:p-16 lg:p-20">
                    {/* Corner decorative crosshair marks (+) */}
                    <span className="absolute left-3.5 top-3.5 font-['Space_Grotesk'] text-[14px] text-[#A1A1AA]">+</span>
                    <span className="absolute right-3.5 top-3.5 font-['Space_Grotesk'] text-[14px] text-[#A1A1AA]">+</span>
                    <span className="absolute bottom-3.5 left-3.5 font-['Space_Grotesk'] text-[14px] text-[#A1A1AA]">+</span>
                    <span className="absolute bottom-3.5 right-3.5 font-['Space_Grotesk'] text-[14px] text-[#A1A1AA]">+</span>

                    <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.5px] text-[#747878]">
                        GET STARTED TODAY
                    </span>

                    <h2 className="mx-auto mt-4 max-w-[720px]">
                        <span className="block font-['Newsreader'] text-[36px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[46px] md:text-[54px]">
                            Conversations that move work
                        </span>
                        <span className="block text-[36px] leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[46px] md:text-[54px]">
                            <span className="font-['Newsreader'] font-normal italic">forward.</span>{" "}
                            <span className="font-['Space_Grotesk'] font-medium">Start in minutes.</span>
                        </span>
                    </h2>

                    <p className="mx-auto mt-5 max-w-[520px] font-['Space_Grotesk'] text-[15px] font-normal leading-[24px] text-[#747878]">
                        Launch your first AI voice agent in less than a day. Experience deterministic operations with zero hallucinations.
                    </p>

                    <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                        {/* Primary Button Logic */}
                        {!isLoading && (
                            <>
                                {user ? (
                                    <Link
                                        href="/dashboard"
                                        className="flex h-11 w-full items-center justify-center rounded-md bg-[#1B1C18] px-6 font-['Space_Grotesk'] text-[13px] font-semibold text-white shadow-xs transition-colors duration-200 hover:bg-[#3A3B37] sm:w-auto"
                                    >
                                        Go to Dashboard
                                    </Link>
                                ) : (
                                    <Link
                                        href="/sign-up"
                                        className="flex h-11 w-full items-center justify-center rounded-md bg-[#1B1C18] px-6 font-['Space_Grotesk'] text-[13px] font-semibold text-white shadow-xs transition-colors duration-200 hover:bg-[#3A3B37] sm:w-auto"
                                    >
                                        Start 7-day free trial
                                    </Link>
                                )}
                            </>
                        )}

                        {/* Secondary Button */}
                        <Link
                            href="/live-demo"
                            className="flex h-11 w-full items-center justify-center rounded-md border border-[#E9E8E1] bg-[#F5F3EC] px-6 font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] transition-colors duration-200 hover:bg-[#E9E8E1] sm:w-auto"
                        >
                            Do a Trial Call
                        </Link>
                    </div>

                    {/* Sub-text guarantee (Hide if logged in) */}
                    {!isLoading && !user && (
                        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-['Space_Grotesk'] text-[11px] text-[#747878]">
                            <span>7-day free trial</span>
                            <span>•</span>
                            <span>No credit card required</span>
                            <span>•</span>
                            <span>Cancel anytime</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer */}
            <footer className="border-t border-[#E9E8E1] bg-[#FBF9F2] pt-14 pb-12">
                <div className="mx-auto w-full max-w-[1240px] px-6 md:px-10">
                    <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
                        {/* Column 1: Brand & Description */}
                        <div className="col-span-2 md:col-span-4 lg:col-span-1">
                            <Link
                                href="/"
                                className="font-['Space_Grotesk'] text-[18px] font-bold tracking-tight lowercase text-[#1B1C18]"
                            >
                                foolioo
                            </Link>
                            <p className="mt-3 max-w-[220px] font-['Space_Grotesk'] text-[13px] leading-[20px] text-[#747878]">
                                AI voice operations with deterministic rigor.
                            </p>
                        </div>

                        {/* Columns 2–5 */}
                        {FOOTER_SECTIONS.map((section) => (
                            <div key={section.title} className="flex flex-col gap-3">
                                <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1px] text-[#747878]">
                                    {section.title}
                                </span>
                                {section.links.map((link) => (
                                    <Link
                                        key={link.label}
                                        href={link.href}
                                        className="text-left font-['Space_Grotesk'] text-[13px] text-[#444748] transition hover:text-[#1B1C18]"
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                            </div>
                        ))}
                    </div>

                    {/* Bottom row */}
                    <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[#E9E8E1] pt-6 sm:flex-row">
                        <p className="font-['Space_Grotesk'] text-[12px] text-[#747878]">
                            &copy; 2026 Foolioo Inc. All rights reserved.
                        </p>
                        <Link
                            href="/status"
                            className="flex items-center gap-2 transition hover:opacity-80"
                        >
                            <span className="h-2 w-2 rounded-full bg-[#22A06B]"></span>
                            <span className="font-['Space_Grotesk'] text-[12px] text-[#747878]">
                                All systems operational
                            </span>
                        </Link>
                    </div>
                </div>
            </footer>
        </section>
    );
};