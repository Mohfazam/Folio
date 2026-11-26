"use client";

import { useState, useEffect, useMemo } from "react";
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
      { label: "Call Scripts & Rules", href: "/product/state-machine" },
      { label: "Integrations", href: "/product/integrations" },
      { label: "Pricing", href: "/#pricing" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Outbound Sales", href: "/solutions/outbound-sales" },
      { label: "Appointment Reminders", href: "/solutions/appointment-reminders" },
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
      { label: "Support", href: "/support" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

export const CtaFooter = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const supportHref = !isLoading && user ? "/dashboard/support" : "/support";

  useEffect(() => {
    let mounted = true;

    const getInitialUser = async () => {
      try {
        const currentUser = await getCurrentUser(supabase);
        if (mounted) setUser(currentUser);
      } catch (error) {
        console.error("Failed to fetch user:", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    getInitialUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  return (
    <section className="w-full border-t border-[#E9E8E1] bg-[#FBF9F2]">
      {/* CTA Card Container */}
      <div className="mx-auto w-full max-w-[1240px] px-6 py-20 md:px-10 md:py-28">
        <div className="relative overflow-hidden rounded-2xl border border-[#E9E8E1] bg-white p-8 text-center shadow-[0px_8px_30px_rgba(0,0,0,0.04)] md:p-16 lg:p-20">
          {/* Corner decorative crosshair marks (+) */}
          <span aria-hidden="true" className="absolute left-3.5 top-3.5 font-['Space_Grotesk'] text-[14px] text-[#A1A1AA]">+</span>
          <span aria-hidden="true" className="absolute right-3.5 top-3.5 font-['Space_Grotesk'] text-[14px] text-[#A1A1AA]">+</span>
          <span aria-hidden="true" className="absolute bottom-3.5 left-3.5 font-['Space_Grotesk'] text-[14px] text-[#A1A1AA]">+</span>
          <span aria-hidden="true" className="absolute bottom-3.5 right-3.5 font-['Space_Grotesk'] text-[14px] text-[#A1A1AA]">+</span>

          <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.5px] text-[#525552]">
            GET STARTED TODAY
          </span>

          <h2 className="mx-auto mt-4 max-w-[720px]">
            <span className="block font-['Newsreader'] text-[36px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[46px] md:text-[54px]">
              Outbound calls that move work
            </span>
            <span className="block text-[36px] leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[46px] md:text-[54px]">
              <span className="font-['Newsreader'] font-normal italic">forward.</span>{" "}
              <span className="font-['Space_Grotesk'] font-medium">Start in minutes.</span>
            </span>
          </h2>

          <p className="mx-auto mt-5 max-w-[54ch] font-['Space_Grotesk'] text-[15px] font-normal leading-[24px] text-[#525552]">
            Start your first outbound calling campaign in minutes with clear scripts, quality checks, and instant CRM updates.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {!isLoading && (
              <>
                {user ? (
                  <Link
                    href="/dashboard"
                    className="flex h-11 w-full items-center justify-center rounded-md bg-[#1B1C18] px-6 font-['Space_Grotesk'] text-[13px] font-semibold text-white shadow-xs transition-colors duration-200 hover:bg-[#3A3B37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2 sm:w-auto"
                  >
                    Go to Dashboard
                  </Link>
                ) : (
                  <Link
                    href="/sign-up"
                    className="flex h-11 w-full items-center justify-center rounded-md bg-[#1B1C18] px-6 font-['Space_Grotesk'] text-[13px] font-semibold text-white shadow-xs transition-colors duration-200 hover:bg-[#3A3B37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2 sm:w-auto"
                  >
                    Start 7-day free trial
                  </Link>
                )}
              </>
            )}

            <Link
              href="/live-demo"
              className="flex h-11 w-full items-center justify-center rounded-md border border-[#E9E8E1] bg-[#F5F3EC] px-6 font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] transition-colors duration-200 hover:bg-[#E9E8E1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2 sm:w-auto"
            >
              Do a Trial Call
            </Link>
          </div>

          {!isLoading && !user && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-['Space_Grotesk'] text-[12px] text-[#525552]">
              <span>7-day free trial</span>
              <span aria-hidden="true">•</span>
              <span>No credit card required</span>
              <span aria-hidden="true">•</span>
              <span>Cancel anytime</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#E9E8E1] bg-[#FBF9F2] pb-12 pt-14">
        <div className="mx-auto w-full max-w-[1240px] px-6 md:px-10">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
            <div className="col-span-2 md:col-span-4 lg:col-span-1">
              <Link
                href="/"
                className="inline-flex items-baseline font-['Newsreader'] text-[28px] font-medium italic leading-none tracking-[-1.2px] text-[#1B1C18] transition-colors hover:text-[#FD7032]"
              >
                foolioo<span className="ml-[1px] not-italic text-[#FD7032]">.</span>
              </Link>
              <p className="mt-3 max-w-[220px] font-['Space_Grotesk'] text-[13px] leading-[20px] text-[#525552]">
                Outbound AI calling that follows your rules.
              </p>
            </div>

            {FOOTER_SECTIONS.map((section) => (
              <div key={section.title} className="flex flex-col gap-3">
                <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1px] text-[#525552]">
                  {section.title}
                </span>
                {section.links.map((link) => (
                  <Link
                    key={link.label}
                    href={link.label === "Support" ? supportHref : link.href}
                    className="rounded-sm text-left font-['Space_Grotesk'] text-[13px] text-[#2D2F2B] transition hover:text-[#FD7032] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[#E9E8E1] pt-6 sm:flex-row">
            <p className="font-['Space_Grotesk'] text-[12px] text-[#525552] tabular-nums">
              &copy; 2026 Foolioo Inc. All rights reserved.
            </p>
            <Link
              href="/status"
              className="flex items-center gap-2 rounded-sm transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032]"
            >
              <span className="h-2 w-2 rounded-full bg-[#22A06B]" />
              <span className="font-['Space_Grotesk'] text-[12px] font-medium text-[#525552]">
                All systems operational
              </span>
            </Link>
          </div>
        </div>
      </footer>
    </section>
  );
};
