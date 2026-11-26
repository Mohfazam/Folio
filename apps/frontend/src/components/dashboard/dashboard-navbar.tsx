"use client";

import Link from "next/link";
import Image from "next/image";

export function DashboardNavbar({ rightSlot }: { rightSlot?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between gap-4 border-b border-[#ECEBE5] bg-[#FCFBF7] px-4 sm:px-6">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="inline-flex shrink-0 items-center gap-2">
          <Image src="/Foolioo.svg" alt="" width={24} height={28} className="h-6 w-auto" />
          <span className="font-['Newsreader'] text-[24px] font-medium italic leading-none tracking-[-1.2px] text-[#1B1C18]">
            foolioo<span className="text-[#FD7032]">.</span>
          </span>
        </Link>

        <nav aria-label="Dashboard navigation" className="flex items-center gap-5">
          <Link
            href="/dashboard"
            className="whitespace-nowrap font-['Space_Grotesk'] text-[14px] font-medium text-[#525552] transition-colors hover:text-[#1B1C18]"
          >
            Overview
          </Link>
          <Link
            href="/dashboard/support"
            className="whitespace-nowrap font-['Space_Grotesk'] text-[14px] font-medium text-[#525552] transition-colors hover:text-[#1B1C18]"
          >
            Help &amp; Support
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-3">{rightSlot}</div>
    </header>
  );
}
