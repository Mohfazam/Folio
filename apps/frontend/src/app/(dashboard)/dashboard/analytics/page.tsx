import { Suspense } from "react";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";
import { AnalyticsQueryContainer } from "@/components/dashboard/query-containers";

type SearchParams = Record<string, string | string[] | undefined>;
type AnalyticsTimeframe = "today" | "7d" | "30d" | "all";

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

async function AnalyticsPageContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const requested = first(params.timeframe);
  const timeframe: AnalyticsTimeframe =
    requested === "today" || requested === "7d" || requested === "30d" || requested === "all"
      ? requested
      : "30d";

  return <AnalyticsQueryContainer timeframe={timeframe} />;
}

export default function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<DashboardPageSkeleton variant="analytics" />}>
      <AnalyticsPageContent searchParams={searchParams} />
    </Suspense>
  );
}
