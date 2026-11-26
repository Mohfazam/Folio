"use client";

import Link from "next/link";
import { getAvailableLocalDevTestPlan } from "@/features/billing/utils/dev-test-plan";

export function LocalDevTestPlanCard({
  isLocalDevTestAvailable,
  onSelectPlan,
}: {
  isLocalDevTestAvailable: boolean;
  onSelectPlan?: (planId: "dev_test") => void;
}) {
  const devPlan = getAvailableLocalDevTestPlan(isLocalDevTestAvailable);
  if (!devPlan) return null;

  return (
    <section
      aria-label="Localhost developer test plan"
      className="rounded-[10px] border border-dashed border-[#B7A7E6] bg-[#FAF8FE] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-[#D8CEF5] bg-[#EFEAFB] px-2.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.08em] text-[#644ABB]">
              {devPlan.badge}
            </span>
            <h2 className="font-['Newsreader'] text-[22px] leading-tight text-[#1B1C18]">
              {devPlan.name}
            </h2>
          </div>
          <p className="mt-1.5 max-w-[540px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#565B5B]">
            {devPlan.description}
          </p>
        </div>

        <div className="text-left sm:text-right">
          <p className="font-['Newsreader'] text-[28px] leading-none text-[#1B1C18]">
            ₹{devPlan.amountInr}
          </p>
          <p className="mt-1 font-['Space_Grotesk'] text-[10px] font-medium text-[#747878]">
            {devPlan.creditsLabel}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E6E0F5] pt-3.5">
        <p className="font-['Space_Grotesk'] text-[11px] text-[#666A68]">
          Hidden in production builds and non-localhost hosts.
        </p>

        {onSelectPlan ? (
          <button
            type="button"
            onClick={() => onSelectPlan("dev_test")}
            className="inline-flex h-9 items-center justify-center rounded-[6px] bg-[#644ABB] px-4 font-['Space_Grotesk'] text-[11px] font-semibold text-white transition-colors hover:bg-[#523AA3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
          >
            Test ₹1 checkout
          </button>
        ) : (
          <Link
            href="/checkout?plan=dev_test"
            className="inline-flex h-9 items-center justify-center rounded-[6px] bg-[#644ABB] px-4 font-['Space_Grotesk'] text-[11px] font-semibold text-white transition-colors hover:bg-[#523AA3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
          >
            Test ₹1 checkout
          </Link>
        )}
      </div>
    </section>
  );
}
