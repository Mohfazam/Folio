"use client";

import Link from "next/link";
import Image from "next/image";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 w-full border-b border-[#E9E8E1] bg-[#FBF9F2]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-4 px-6 md:px-10">
        <Link href="/" className="inline-flex shrink-0 items-center gap-2.5">
          <Image src="/Foolioo.svg" alt="" width={28} height={32} className="h-7 w-auto" />
          <span className="font-['Newsreader'] text-[28px] font-medium italic leading-none tracking-[-1.4px] text-[#1B1C18]">
            foolioo<span className="text-[#FD7032]">.</span>
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="flex items-center gap-5 sm:gap-7">
          <Link
            href="/#products"
            className="hidden whitespace-nowrap font-['Space_Grotesk'] text-[13px] font-medium text-[#525552] transition-colors hover:text-[#1B1C18] md:inline-block"
          >
            How it works
          </Link>
          <Link
            href="/#pricing"
            className="hidden whitespace-nowrap font-['Space_Grotesk'] text-[13px] font-medium text-[#525552] transition-colors hover:text-[#1B1C18] sm:inline-block"
          >
            Pricing
          </Link>
          <Link
            href="/#faq"
            className="hidden whitespace-nowrap font-['Space_Grotesk'] text-[13px] font-medium text-[#525552] transition-colors hover:text-[#1B1C18] lg:inline-block"
          >
            FAQ
          </Link>
          <Link
            href="/support"
            className="whitespace-nowrap font-['Space_Grotesk'] text-[13px] font-medium text-[#525552] transition-colors hover:text-[#1B1C18]"
          >
            Support
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[12.5px] font-semibold text-white transition hover:bg-[#34352F]"
          >
            Sign In
          </Link>
        </nav>
      </div>
    </header>
  );
}
