import { Suspense } from "react";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";
import { ContactsQueryContainer } from "@/components/dashboard/query-containers";
import type { ContactFilters } from "@/components/dashboard/contacts-dashboard";

type SearchParams = Record<string, string | string[] | undefined>;

const ALLOWED_STATUSES = new Set([
  "pending",
  "queued",
  "in_progress",
  "completed",
  "do_not_call",
  "invalid",
]);
const ALLOWED_LIFECYCLE_STAGES = new Set([
  "lead",
  "prospect",
  "mql",
  "sql",
  "customer",
  "churned",
]);

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function numberParam(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

async function ContactsPageContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const requestedStatus = first(params.status);
  const requestedLifecycle = first(params.lifecycleStage);

  const filters: ContactFilters = {
    search: first(params.search).trim().slice(0, 200),
    status: ALLOWED_STATUSES.has(requestedStatus) ? requestedStatus : "",
    lifecycleStage: ALLOWED_LIFECYCLE_STAGES.has(requestedLifecycle) ? requestedLifecycle : "",
    limit: numberParam(first(params.limit), 25, 1, 100),
    offset: numberParam(first(params.offset), 0, 0, 1_000_000),
  };
  const startInImportMode = first(params.import) === "1";

  return (
    <ContactsQueryContainer
      filters={filters}
      startInImportMode={startInImportMode}
    />
  );
}

export default function ContactsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<DashboardPageSkeleton variant="table" />}>
      <ContactsPageContent searchParams={searchParams} />
    </Suspense>
  );
}
