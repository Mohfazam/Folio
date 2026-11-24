"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { dashboardKeys } from "@/lib/query/keys";
import { sanitizeUserError } from "@/lib/utils/sanitize-error";

export default function DashboardRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isRetrying, startTransition] = useTransition();

  useEffect(() => {
    console.error("[dashboard/error] Route error boundary caught:", error);
  }, [error]);

  const safeMessage = sanitizeUserError(
    error?.message,
    "Something went wrong while rendering this dashboard view. Your data and session are safe.",
  );

  const handleTryAgain = () => {
    startTransition(() => {
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
      router.refresh();
      reset();
    });
  };

  return (
    <div className="mx-auto w-full max-w-[760px] py-6">
      <section
        role="alert"
        className="rounded-xl border border-[#F0D8D4] bg-[#FFF8F7] p-6 sm:p-8"
      >
        <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#A33A32]">
          WORKSPACE RECOVERY
        </p>
        <h1 className="mt-2 font-['Newsreader'] text-[28px] leading-tight text-[#1B1C18] sm:text-[32px]">
          This view ran into an unexpected error
        </h1>
        <p className="mt-2 font-['Space_Grotesk'] text-[13px] leading-5 text-[#565B5B]">
          {safeMessage}
        </p>
        {error?.digest ? (
          <p className="mt-3 font-mono text-[11px] text-[#7A271A]">
            Error ID: {error.digest}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={isRetrying}
            onClick={handleTryAgain}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition hover:bg-[#34352F] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
          >
            {isRetrying ? "Retrying…" : "Try again"}
          </button>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-[#DCDCD4] bg-white px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18] transition hover:bg-[#F5F4ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
          >
            Back to Overview
          </Link>
        </div>
      </section>
    </div>
  );
}
