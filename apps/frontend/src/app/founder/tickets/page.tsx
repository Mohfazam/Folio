import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";
import { AdminTicketsDashboard } from "@/components/dashboard/admin-tickets-dashboard";

export const metadata: Metadata = {
  title: "Founder Support Queue · Foolioo",
  description: "Founder inbox for incoming user complaints and support tickets.",
};

export default function FounderTicketsPage() {
  return (
    <div className="min-h-screen bg-[#FBF9F2] text-[#1B1C18]">
      <header className="border-b border-[#EAE7DE] bg-[#FCFBF7] px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <Image src="/Foolioo.svg" alt="" width={28} height={32} className="h-7 w-auto" />
            <span className="font-['Newsreader'] text-[28px] font-medium italic tracking-[-1.4px]">
              foolioo<span className="text-[#FD7032]">.</span>
            </span>
            <span className="ml-2 rounded-full border border-[#E7DEFF] bg-[#F4F0FF] px-2.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[1px] text-[#644ABB]">
              Founders
            </span>
          </Link>

          <div className="flex items-center gap-4 font-['Space_Grotesk'] text-[13px]">
            <Link href="/dashboard" className="text-[#55534F] hover:text-[#1B1C18]">
              Workspace
            </Link>
            <Link
              href="/"
              className="rounded-full border border-[#EAE7DE] bg-white px-4 py-1.5 font-medium hover:bg-[#F5F3EC]"
            >
              Landing page
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <Suspense fallback={<DashboardPageSkeleton variant="table" />}>
          <AdminTicketsDashboard />
        </Suspense>
      </main>
    </div>
  );
}
