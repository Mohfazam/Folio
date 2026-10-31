"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Hero_top_left } from "@/components/utils/hero_top_left";
import { Hero_top_right } from "@/components/utils/hero_top_right";
import { Hero_bottom_left } from "@/components/utils/hero_bottom_left";
import { Hero_bottom_right } from "@/components/utils/hero_bottom_right";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";

export const Hero = () => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        const getInitialUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            setIsLoading(false);
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
        <section id="demo" className="relative mx-auto w-full max-w-7xl overflow-hidden px-6 pb-20 pt-10 md:px-10 md:pb-28 md:pt-16 lg:px-12">
            {/* Floating cards for desktop view */}
            <div className="pointer-events-none absolute left-2 top-16 hidden xl:block">
                <div className="pointer-events-auto">
                    <Hero_top_left />
                </div>
            </div>

            <div className="pointer-events-none absolute right-6 top-12 hidden xl:block">
                <div className="pointer-events-auto">
                    <Hero_top_right />
                </div>
            </div>

            <div className="pointer-events-none absolute bottom-12 left-8 hidden xl:block">
                <div className="pointer-events-auto">
                    <Hero_bottom_left />
                </div>
            </div>

            <div className="pointer-events-none absolute bottom-12 right-8 hidden xl:block">
                <div className="pointer-events-auto">
                    <Hero_bottom_right />
                </div>
            </div>

            {/* Central hero content */}
            <div className="mx-auto flex max-w-210 flex-col items-center text-center">
                
                {/* Main headline */}
                <h1 className="tracking-tight">
                    <span className="block font-['Newsreader'] text-[46px] font-normal leading-[1.08] tracking-[-1px] text-[#1B1C18] sm:text-[56px] md:text-[68px]">
                        A complete system
                    </span>
                    <span className="block font-['Space_Grotesk'] text-[46px] font-medium leading-[1.08] tracking-[-1px] text-[#1B1C18] sm:text-[56px] md:text-[68px]">
                        for AI voice operations
                    </span>
                    <span className="block font-['Newsreader'] text-[46px] font-normal italic leading-[1.08] tracking-[-1px] text-[#1B1C18] sm:text-[56px] md:text-[68px]">
                        with deterministic rigor.
                    </span>
                </h1>

                {/* Subtitle */}
                <p className="mt-6 max-w-[580px] font-['Space_Grotesk'] text-[15px] font-normal leading-[24px] tracking-[0.1px] text-[#747878] md:text-[16px]">
                    Run voice calls with the reliability of software, not the variability of
                    people. Foolioo combines an AI-powered dialer with a deterministic voice agent
                    to give your team full control over every conversation.
                </p>

                {/* CTA Area (Dynamic based on Auth) */}
                <div className="mt-8 flex w-full max-w-[460px] flex-col items-center justify-center">
                    {!isLoading && (
                        <>
                            {user ? (
                                // LOGGED IN STATE
                                <Link 
                                    href="/dashboard" 
                                    className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[13px] font-medium text-white shadow-xs transition-colors duration-200 hover:bg-[#3A3B37]"
                                >
                                    Go to Dashboard
                                    <span>→</span>
                                </Link>
                            ) : (
                                // LOGGED OUT STATE
                                <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-2">
                                    <input
                                        type="email"
                                        placeholder="Enter your work email"
                                        className="h-11 flex-1 rounded-md border border-[#E9E8E1] bg-white px-4 font-['Space_Grotesk'] text-[13px] text-[#1B1C18] placeholder-[#747878] shadow-xs outline-none transition focus:border-[#1B1C18]"
                                    />
                                    <Link 
                                        href="/sign-up" 
                                        className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[13px] font-medium text-white shadow-xs transition-colors duration-200 hover:bg-[#3A3B37]"
                                    >
                                        Start free trial
                                        <span>→</span>
                                    </Link>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Sub-text guarantee (Hide if logged in) */}
                {!isLoading && !user && (
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-['Space_Grotesk'] text-[11px] font-normal text-[#747878]">
                        <span>7-day free trial</span>
                        <span>•</span>
                        <span>No credit card required</span>
                        <span>•</span>
                        <span>Cancel anytime</span>
                    </div>
                )}
            </div>
        </section>
    );
};