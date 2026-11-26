"use client";

import Link from "next/link";

interface SupportRecoveryNoticeProps {
  message?: string | null;
  className?: string;
}

export function SupportRecoveryNotice({
  message,
  className = "",
}: SupportRecoveryNoticeProps) {
  return (
    <div
      role="alert"
      className={`rounded-lg border border-[#F0D8D4] bg-[#FFF8F7] px-4 py-3 font-['Space_Grotesk'] text-[12px] text-[#A33A32] ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{message || "Something went wrong while completing your request."}</span>
        <span className="text-[#525552]">
          Need help?{" "}
          <Link
            href="/support"
            className="font-semibold text-[#1B1C18] underline decoration-[#DCD8CC] underline-offset-4 hover:text-[#FD7032]"
          >
            Contact Support
          </Link>
        </span>
      </div>
    </div>
  );
}
