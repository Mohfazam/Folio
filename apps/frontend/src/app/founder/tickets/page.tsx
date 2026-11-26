import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";
import { AdminTicketsDashboard } from "@/components/dashboard/admin-tickets-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Founder Support Queue · Foolioo",
  description: "Founder inbox for incoming user complaints and support tickets.",
};

function backendBaseUrl(): string {
  return (
    process.env.BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://127.0.0.1:4000"
  )
    .replace(/^http:\/\/localhost(?=[:/]|$)/i, "http://127.0.0.1")
    .replace(/\/+$/, "");
}

async function isInternalAdminSession(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch(`${backendBaseUrl()}/api/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as {
      user?: { role?: string };
      role?: string;
    } | null;
    const role = data?.user?.role ?? data?.role;
    return role === "internal_admin";
  } catch {
    return false;
  }
}

export default async function FounderTicketsPage() {
  const auth = await getDashboardAuthContext();
  const allowed = auth ? await isInternalAdminSession(auth.accessToken) : false;

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
        {!allowed ? (
          <section className="mx-auto mt-8 max-w-lg rounded-2xl border border-[#EAE7DE] bg-white p-8 text-center shadow-sm">
            <span className="inline-flex rounded-full border border-[#F0D8D4] bg-[#FFF8F7] px-3 py-1 font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[1.1px] text-[#A33A32]">
              Restricted · Founder Access Only
            </span>
            <h1 className="mt-4 font-['Newsreader'] text-[34px] leading-tight tracking-[-0.8px] text-[#1B1C18]">
              Founder queue access required
            </h1>
            <p className="mt-2.5 font-['Space_Grotesk'] text-[13px] leading-[20px] text-[#525552]">
              {auth
                ? "Your signed-in account does not have internal_admin founder permissions."
                : "Sign in with an internal_admin account to view incoming support tickets."}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={auth ? "/dashboard" : "/sign-in?redirect=/founder/tickets"}
                className="inline-flex h-10 items-center justify-center rounded-md bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[12px] font-semibold text-white hover:bg-[#34352F]"
              >
                {auth ? "Go to Workspace" : "Sign In"}
              </Link>
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center rounded-md border border-[#DCD8CC] bg-white px-5 font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18] hover:bg-[#F5F3EC]"
              >
                Back to Home
              </Link>
            </div>
          </section>
        ) : (
          <Suspense fallback={<DashboardPageSkeleton variant="table" />}>
            <AdminTicketsDashboard />
          </Suspense>
        )}
      </main>
    </div>
  );
}
