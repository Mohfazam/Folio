import { Suspense } from "react";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";
import { FollowUpsQueryContainer } from "@/components/dashboard/query-containers";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

async function FollowUpsPageContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const requestedStatus = first(params.status);
  const status = ["open", "done", "not_needed"].includes(requestedStatus)
    ? requestedStatus
    : "open";

  return <FollowUpsQueryContainer initialStatus={status} />;
}

export default function FollowUpsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<DashboardPageSkeleton variant="table" />}>
      <FollowUpsPageContent searchParams={searchParams} />
    </Suspense>
  );
}
