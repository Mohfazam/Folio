import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Page Not Found · Foolioo",
  description:
    "The page you requested could not be found. Explore Foolioo enterprise communication automation, try a live demo call, or return home.",
};

const POPULAR_DESTINATIONS = [
  {
    eyebrow: "LIVE EXPERIENCE",
    title: "Try a Live AI Call",
    description:
      "Receive a real 2-minute interactive call on your phone—no sign-up or credit card required.",
    href: "/live-demo",
    cta: "Start trial call",
    accent: true,
  },
  {
    eyebrow: "PLATFORM",
    title: "Capabilities & Workflows",
    description:
      "See how Foolioo automates outbound & inbound voice, email, SMS, queries, and MCP tools.",
    href: "/#products",
    cta: "Explore platform",
    accent: false,
  },
  {
    eyebrow: "TRANSPARENT RATES",
    title: "Simple Credit Pricing",
    description:
      "Pay only for connected talk time starting at ₹4.20/minute with a 7-day free trial.",
    href: "/#pricing",
    cta: "View pricing",
    accent: false,
  },
  {
    eyebrow: "WORKSPACE",
    title: "Sign In to Dashboard",
    description:
      "Manage active campaigns, call recordings, transcripts, and follow-up queues.",
    href: "/dashboard",
    cta: "Open dashboard",
    accent: false,
  },
];

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FBF9F2] text-[#1B1C18]">
      {/* Top Minimal Header */}
      <header className="border-b border-[#EAE6DC] bg-[#FBF9F2]/90 backdrop-blur-sm">
        <div className="mx-auto flex h-[72px] w-full max-w-[1240px] items-center justify-between px-6 md:px-10">
          <Link
            href="/"
            aria-label="Foolioo home"
            className="group inline-flex items-center gap-[9px] rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-4 focus-visible:ring-offset-[#FBF9F2]"
          >
            <Image
              src="/Foolioo.svg"
              alt=""
              aria-hidden="true"
              width={29}
              height={34}
              priority
              className="h-[32px] w-[27px] object-contain transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-[1.04]"
            />
            <span className="relative -mt-0.5 inline-flex items-baseline font-['Newsreader'] text-[30px] font-medium italic leading-none tracking-[-1.5px] text-[#1B1C18] transition-colors duration-200 group-hover:text-[#FD7032]">
              foolioo
              <span className="ml-[1px] not-italic text-[#FD7032]">.</span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/support"
              className="hidden font-['Space_Grotesk'] text-[13px] font-medium text-[#525552] transition-colors hover:text-[#1B1C18] sm:inline-block"
            >
              Support
            </Link>
            <Link
              href="/"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[12px] font-semibold text-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#34352F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF9F2]"
            >
              Back to Home →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-[1160px] flex-1 flex-col justify-center px-6 py-14 md:px-10 md:py-20">
        {/* Editorial 404 Hero Block */}
        <div className="mx-auto flex max-w-[700px] flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E3DFD3] bg-white px-3.5 py-1 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-[#FD7032]" />
            <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.3px] text-[#525552] tabular-nums">
              Error 404 · Route Not Found
            </span>
          </div>

          <h1 className="mt-6 tracking-tight">
            <span className="block font-['Newsreader'] text-[40px] font-normal leading-[1.08] tracking-[-0.9px] text-[#1B1C18] sm:text-[52px] md:text-[60px]">
              Looks like this line
            </span>
            <span className="block font-['Newsreader'] text-[40px] font-normal italic leading-[1.08] tracking-[-0.9px] text-[#1B1C18] sm:text-[52px] md:text-[60px]">
              isn&apos;t connected yet.
            </span>
          </h1>

          <p className="mt-5 max-w-[54ch] font-['Space_Grotesk'] text-[15px] leading-[24px] text-[#525552]">
            The page you&apos;re looking for may have moved, been renamed, or is still in rollout. Here&apos;s how you can jump right back into Foolioo.
          </p>

          {/* Primary Conversion CTAs */}
          <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <Link
              href="/"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#1B1C18] px-6 font-['Space_Grotesk'] text-[13px] font-semibold text-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#34352F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF9F2] sm:w-auto"
            >
              <span>Return to Home</span>
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/live-demo"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-[#DCD8CC] bg-white px-6 font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] shadow-2xs transition-colors duration-200 hover:bg-[#F5F3EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF9F2] sm:w-auto"
            >
              <span>Experience a Trial Call</span>
            </Link>
          </div>
        </div>

        {/* Apple-style Curated Destination Directory */}
        <div className="mt-14">
          <p className="text-center font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.4px] text-[#525552]">
            POPULAR DESTINATIONS
          </p>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {POPULAR_DESTINATIONS.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className={`group flex flex-col justify-between rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] ${
                  item.accent
                    ? "border-[#1B1C18] bg-white shadow-[0_10px_28px_rgba(27,28,24,0.06)]"
                    : "border-[#E3DFD3] bg-white shadow-[0_2px_10px_rgba(27,28,24,0.025)] hover:border-[#C9C5B8]"
                }`}
              >
                <div>
                  <span
                    className={`font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[1.2px] ${
                      item.accent ? "text-[#FD7032]" : "text-[#747878]"
                    }`}
                  >
                    {item.eyebrow}
                  </span>
                  <h2 className="mt-2 font-['Space_Grotesk'] text-[16px] font-bold text-[#1B1C18]">
                    {item.title}
                  </h2>
                  <p className="mt-1.5 font-['Space_Grotesk'] text-[12.5px] leading-[19px] text-[#525552]">
                    {item.description}
                  </p>
                </div>

                <div className="mt-5 inline-flex items-center gap-1.5 font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18] transition-colors group-hover:text-[#FD7032]">
                  <span>{item.cta}</span>
                  <span
                    aria-hidden="true"
                    className="transition-transform duration-200 group-hover:translate-x-1"
                  >
                    →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Amazon / Stripe Inspired Social Proof & Brand Quote Strip */}
        <div className="mt-10 rounded-2xl border border-[#E3DFD3] bg-white px-6 py-6 shadow-[0_4px_20px_rgba(27,28,24,0.03)] sm:px-8">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-[600px]">
              <p className="font-['Newsreader'] text-[20px] font-normal italic leading-[1.35] text-[#1B1C18] sm:text-[22px]">
                &ldquo;Every missed conversation is a missed relationship. Automate the routine, keep humans for the moments that matter.&rdquo;
              </p>
              <p className="mt-2 font-['Space_Grotesk'] text-[12px] font-medium text-[#525552]">
                Foolioo Enterprise Communication Automation · Outbound, Inbound, Email, SMS &amp; MCP
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 border-t border-[#ECEBE4] pt-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <div>
                <p className="font-['Space_Grotesk'] text-[18px] font-bold text-[#1B1C18] tabular-nums">
                  ₹4.20/min
                </p>
                <p className="font-['Space_Grotesk'] text-[11px] text-[#525552]">
                  ~77% less than BPOs
                </p>
              </div>
              <div className="h-8 w-px bg-[#E9E8E1]" aria-hidden="true" />
              <div>
                <p className="font-['Space_Grotesk'] text-[18px] font-bold text-[#1B1C18] tabular-nums">
                  240ms
                </p>
                <p className="font-['Space_Grotesk'] text-[11px] text-[#525552]">
                  Natural voice latency
                </p>
              </div>
              <div className="h-8 w-px bg-[#E9E8E1]" aria-hidden="true" />
              <div>
                <p className="font-['Space_Grotesk'] text-[18px] font-bold text-[#22A06B] tabular-nums">
                  99.95%
                </p>
                <p className="font-['Space_Grotesk'] text-[11px] text-[#525552]">
                  Enterprise uptime
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E9E8E1] bg-[#FBF9F2] py-6">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col items-center justify-between gap-3 px-6 sm:flex-row md:px-10">
          <p className="font-['Space_Grotesk'] text-[12px] text-[#525552]">
            &copy; 2026 Foolioo Inc. All rights reserved.
          </p>
          <div className="flex items-center gap-5 font-['Space_Grotesk'] text-[12px] text-[#525552]">
            <Link href="/" className="transition-colors hover:text-[#1B1C18]">
              Home
            </Link>
            <Link href="/live-demo" className="transition-colors hover:text-[#1B1C18]">
              Live Demo
            </Link>
            <Link href="/support" className="transition-colors hover:text-[#1B1C18]">
              Support
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-[#1B1C18]">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-[#1B1C18]">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
