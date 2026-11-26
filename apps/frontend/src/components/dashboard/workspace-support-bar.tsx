"use client";

import Link from "next/link";

export function WorkspaceSupportLink({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/support"
      className={`inline-flex items-center gap-1.5 whitespace-nowrap font-['Space_Grotesk'] text-[12.5px] font-medium text-[#525552] transition-colors hover:text-[#1B1C18] ${className}`}
    >
      <span>Support</span>
    </Link>
  );
}
