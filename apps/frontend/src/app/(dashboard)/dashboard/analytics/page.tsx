import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";
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
  const auth = await getDashboardAuthContext();
  if (!auth) redirect("/sign-in");
  const accessToken = auth.accessToken;
  const baseUrl = (process.env.BACKEND_API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:4000").replace(/\/+$/, "");
  try {
    const response = await fetch(`${baseUrl}/api/analytics/overview?timeframe=${timeframe}`, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
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
export default function AnalyticsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <AnalyticsPageContent searchParams={searchParams} />;
}
