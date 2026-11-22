import { Suspense } from "react";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";
import { CallsQueryContainer } from "@/components/dashboard/query-containers";
import type { CallFilters } from "@/components/dashboard/calls-dashboard";

type SearchParams = Record<string, string | string[] | undefined>;

const OUTCOMES = new Set([
  "connected",
  "no_answer",
  "busy",
  "voicemail",
  "dropped_early",
  "failed",
]);
const SENTIMENTS = new Set(["positive", "neutral", "negative"]);
const INTEREST_LEVELS = new Set(["high", "medium", "low", "unknown"]);

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function numberParam(value: string, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function validDateParam(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? ""
    : value;
}

async function CallsPageContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const requestedCampaignId = first(params.campaignId).trim();
  const validCampaignId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestedCampaignId)
      ? requestedCampaignId
      : "";
  const requestedOutcome = first(params.outcome);
  const requestedSentiment = first(params.sentiment);
  const requestedInterest = first(params.interestLevel);

  const filters: CallFilters = {
    search: first(params.search).trim().slice(0, 200),
    outcome: OUTCOMES.has(requestedOutcome) ? requestedOutcome : "",
    sentiment: SENTIMENTS.has(requestedSentiment) ? requestedSentiment : "",
    interestLevel: INTEREST_LEVELS.has(requestedInterest) ? requestedInterest : "",
    startDate: validDateParam(first(params.startDate)),
    endDate: validDateParam(first(params.endDate)),
    limit: numberParam(first(params.limit), 25, 10, 100),
    offset: numberParam(first(params.offset), 0, 0, 10_000_000),
  };

  return <CallsQueryContainer filters={filters} campaignId={validCampaignId} />;
}

export default function CallsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <Suspense fallback={<DashboardPageSkeleton variant="table" />}>
      <CallsPageContent searchParams={searchParams} />
    </Suspense>
  );
}
