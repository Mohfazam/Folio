import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AnalyticsDashboard, type AnalyticsData } from "@/components/dashboard/analytics-dashboard";

type SearchParams = Record<string, string | string[] | undefined>;
type JsonRecord = Record<string, unknown>;
function isRecord(value: unknown): value is JsonRecord { return typeof value === "object" && value !== null && !Array.isArray(value); }
function first(value: string | string[] | undefined): string { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }

async function AnalyticsPageContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection();
  const params = await searchParams;
  const requested = first(params.timeframe);
  const timeframe = ["today", "7d", "30d", "all"].includes(requested) ? requested : "30d";
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/sign-in");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) redirect("/sign-in");
  const baseUrl = process.env.BACKEND_API_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) return <AnalyticsDashboard timeframe={timeframe} data={null} error="BACKEND_API_URL is not configured for the Next.js server." />;
  try {
    const response = await fetch(`${baseUrl}/api/analytics/overview?timeframe=${timeframe}`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const message = isRecord(payload) && typeof payload.error === "string" ? payload.error : `Analytics request failed (${response.status}).`;
      return <AnalyticsDashboard timeframe={timeframe} data={null} error={message} />;
    }
    return <AnalyticsDashboard timeframe={timeframe} data={payload as unknown as AnalyticsData} error={null} />;
  } catch (cause) {
    return <AnalyticsDashboard timeframe={timeframe} data={null} error={cause instanceof Error ? cause.message : "Unable to load analytics."} />;
  }
}
function AnalyticsLoading() { return <div className="space-y-5" aria-busy="true"><div className="h-16 animate-pulse rounded-lg bg-[#F0EFE9]" /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0,1,2,3].map((item) => <div key={item} className="h-28 animate-pulse rounded-lg bg-[#F0EFE9]" />)}</div><div className="h-80 animate-pulse rounded-lg bg-[#F0EFE9]" /></div>; }
export default function AnalyticsPage({ searchParams }: { searchParams: Promise<SearchParams> }) { return <Suspense fallback={<AnalyticsLoading />}><AnalyticsPageContent searchParams={searchParams} /></Suspense>; }
