import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CallsDashboard,
  type CallRecord,
  type CallFilters,
} from "@/components/dashboard/calls-dashboard";

type JsonRecord = Record<string, unknown>;
type SearchParams = Record<string, string | string[] | undefined>;

type BackendGetResult = {
  ok: boolean;
  status: number;
  payload: unknown;
  error?: string;
};

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

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toCall(value: unknown): CallRecord | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;

  return {
    id: value.id,
    contactId: typeof value.contactId === "string" ? value.contactId : null,
    campaignId: typeof value.campaignId === "string" ? value.campaignId : null,
    contactName: nullableString(value.contactName),
    phoneNumber: nullableString(value.phoneNumber),
    attemptNumber: nullableNumber(value.attemptNumber) ?? 1,
    startedAt: nullableString(value.startedAt),
    endedAt: nullableString(value.endedAt),
    durationSeconds: nullableNumber(value.durationSeconds),
    outcome: typeof value.outcome === "string" ? value.outcome : "unknown",
    isBillable: value.isBillable === true,
    creditsCharged: nullableNumber(value.creditsCharged) ?? 0,
    summary: nullableString(value.summary),
    interestLevel: nullableString(value.interestLevel),
    sentiment: nullableString(value.sentiment),
    followUpRequested: value.followUpRequested === true,
    costTotal: nullableNumber(value.costTotal),
    recordingUrl: nullableString(value.recordingUrl),
    campaignName: nullableString(value.campaignName),
  };
}

async function getAccessToken(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/sign-in");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) redirect("/sign-in");
  return session.access_token;
}

async function backendGet(url: string, token: string): Promise<BackendGetResult> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const message = isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status}).`;
      return { ok: false, status: response.status, payload, error: message };
    }

    return { ok: true, status: response.status, payload };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      payload: null,
      error: error instanceof Error ? error.message : "Unable to reach the backend.",
    };
  }
}

async function CallsPageContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await connection();

  const params = await searchParams;
  const requestedOutcome = first(params.outcome);
  const requestedSentiment = first(params.sentiment);
  const requestedInterest = first(params.interestLevel);
  const limit = numberParam(first(params.limit), 25, 10, 100);
  const offset = numberParam(first(params.offset), 0, 0, 10_000_000);

  const filters: CallFilters = {
    search: first(params.search).trim().slice(0, 200),
    outcome: OUTCOMES.has(requestedOutcome) ? requestedOutcome : "",
    sentiment: SENTIMENTS.has(requestedSentiment) ? requestedSentiment : "",
    interestLevel: INTEREST_LEVELS.has(requestedInterest) ? requestedInterest : "",
    startDate: validDateParam(first(params.startDate)),
    endDate: validDateParam(first(params.endDate)),
    limit,
    offset,
  };

  const baseUrl = process.env.BACKEND_API_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    return (
      <CallsDashboard
        calls={[]}
        total={0}
        filters={filters}
        initialError="BACKEND_API_URL is not configured for the Next.js server."
      />
    );
  }

  const token = await getAccessToken();
  const callsQuery = new URLSearchParams({
    limit: String(filters.limit),
    offset: String(filters.offset),
  });
  if (filters.search) callsQuery.set("search", filters.search);
  if (filters.outcome) callsQuery.set("outcome", filters.outcome);
  if (filters.sentiment) callsQuery.set("sentiment", filters.sentiment);
  if (filters.interestLevel) callsQuery.set("interestLevel", filters.interestLevel);
  if (filters.startDate) callsQuery.set("startDate", filters.startDate);
  if (filters.endDate) callsQuery.set("endDate", `${filters.endDate}T23:59:59.999Z`);

  const callsResult = await backendGet(`${baseUrl}/api/calls?${callsQuery.toString()}`, token);

  let calls: CallRecord[] = [];
  let total = 0;
  let initialError: string | null = null;

  if (callsResult.ok && isRecord(callsResult.payload)) {
    const rows = Array.isArray(callsResult.payload.calls) ? callsResult.payload.calls : [];
    calls = rows.map(toCall).filter((item): item is CallRecord => item !== null);
    total = typeof callsResult.payload.total === "number"
      ? callsResult.payload.total
      : calls.length;
  } else {
    initialError = callsResult.error ?? "Unable to load calls.";
  }

  return (
    <CallsDashboard
      calls={calls}
      total={total}
      filters={filters}
      initialError={initialError}
    />
  );
}

function CallsLoading() {
  return (
    <div className="space-y-6" aria-live="polite" aria-busy="true">
      <div>
        <div className="h-3 w-32 animate-pulse rounded bg-[#E9E8E1]" />
        <div className="mt-3 h-10 w-48 animate-pulse rounded bg-[#E9E8E1]" />
        <div className="mt-3 h-4 w-full max-w-[520px] animate-pulse rounded bg-[#F0EFE9]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-[8px] border border-[#ECEBE5] bg-[#FFFEFB]" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-[8px] border border-[#ECEBE5] bg-[#FFFEFB]" />
      <span className="sr-only">Loading calls…</span>
    </div>
  );
}

export default function CallsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<CallsLoading />}>
      <CallsPageContent searchParams={searchParams} />
    </Suspense>
  );
}
