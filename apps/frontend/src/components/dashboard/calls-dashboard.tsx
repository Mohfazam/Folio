"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createTestCallAction } from "@/app/(dashboard)/dashboard/actions";

export type CallRecord = {
  id: string;
  contactId: string | null;
  campaignId: string | null;
  contactName: string | null;
  phoneNumber: string | null;
  attemptNumber: number;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  outcome: string;
  isBillable: boolean;
  creditsCharged: number;
  summary: string | null;
  interestLevel: string | null;
  sentiment: string | null;
  followUpRequested: boolean;
  costTotal: number | null;
  recordingUrl: string | null;
  campaignName: string | null;
};

export type CallFilters = {
  search: string;
  outcome: string;
  sentiment: string;
  interestLevel: string;
  startDate: string;
  endDate: string;
  limit: number;
  offset: number;
};

const OUTCOME_LABELS: Record<string, string> = {
  connected: "Connected",
  no_answer: "No answer",
  busy: "Busy",
  voicemail: "Voicemail",
  dropped_early: "Dropped early",
  failed: "Failed",
};

const OUTCOME_STYLES: Record<string, string> = {
  connected: "border-[#CDE5D4] bg-[#EFF8F1] text-[#34734B]",
  no_answer: "border-[#E5E1D5] bg-[#F7F5EF] text-[#696B62]",
  busy: "border-[#F0DFB8] bg-[#FFFAEC] text-[#8A6826]",
  voicemail: "border-[#D9DDE7] bg-[#F2F4F8] text-[#59647C]",
  dropped_early: "border-[#F0DFB8] bg-[#FFFAEC] text-[#8A6826]",
  failed: "border-[#F0D8D4] bg-[#FFF8F7] text-[#A33A32]",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "purple" | "amber" | "red";
}) {
  const tones = {
    neutral: "border-[#E5E1D5] bg-[#F7F5EF] text-[#696B62]",
    green: "border-[#CDE5D4] bg-[#EFF8F1] text-[#34734B]",
    purple: "border-[#E8E3F2] bg-[#F7F4FC] text-[#705AA8]",
    amber: "border-[#F0DFB8] bg-[#FFFAEC] text-[#8A6826]",
    red: "border-[#F0D8D4] bg-[#FFF8F7] text-[#A33A32]",
  };

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 font-['Space_Grotesk'] text-[10px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[8px] border border-[#ECEBE5] bg-[#FFFEFB] px-4 py-4 sm:px-5">
      <p className="font-['Space_Grotesk'] text-[11px] font-medium text-[#747878]">{label}</p>
      <p className="mt-2 font-['Newsreader'] text-[30px] leading-none tracking-[-0.5px] text-[#1B1C18]">{value}</p>
      <p className="mt-2 font-['Space_Grotesk'] text-[10px] text-[#92938C]">{detail}</p>
    </div>
  );
}

function filterHref(filters: CallFilters, changes: Partial<CallFilters>) {
  const next = { ...filters, ...changes };
  const query = new URLSearchParams();
  if (next.search) query.set("search", next.search);
  if (next.outcome) query.set("outcome", next.outcome);
  if (next.sentiment) query.set("sentiment", next.sentiment);
  if (next.interestLevel) query.set("interestLevel", next.interestLevel);
  if (next.startDate) query.set("startDate", next.startDate);
  if (next.endDate) query.set("endDate", next.endDate);
  query.set("limit", String(next.limit));
  query.set("offset", String(next.offset));
  const serialized = query.toString();
  return serialized ? `/dashboard/calls?${serialized}` : "/dashboard/calls";
}


function CallComposer({
  onClose,
  onQueued,
}: {
  onClose: () => void;
  onQueued: (message: string) => void;
}) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    const normalizedPhone = phoneNumber.replace(/[\s()-]/g, "");
    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setError("Enter a valid international phone number, including the + country code.");
      return;
    }
    if (!confirmed) {
      setError("Confirm that you have permission to call this number.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await createTestCallAction(normalizedPhone, confirmed);
      if (!result.ok) {
        setError(result.error || "The call could not be queued.");
        return;
      }
      onQueued(`Your call to ${normalizedPhone} has been queued. It will be attempted when the calling service is available, subject to workspace limits.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The call could not be queued.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-[#1B1C18]/35 p-3 sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="make-call-title"
        className="my-5 w-full max-w-[500px] overflow-hidden rounded-[10px] border border-[#E9E8E1] bg-white shadow-[0_20px_64px_rgba(27,28,24,0.2)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#ECEBE5] px-5 py-4 sm:px-6">
          <div>
            <p className="font-['Space_Grotesk'] text-[10px] font-bold tracking-[0.09em] text-[#747878]">OUTBOUND CALL</p>
            <h2 id="make-call-title" className="mt-1 font-['Newsreader'] text-[27px] leading-tight text-[#1B1C18]">Make a call</h2>
            <p className="mt-1 max-w-[400px] font-['Space_Grotesk'] text-[11px] leading-5 text-[#747878]">
              Enter any phone number in international format. You do not need to create a contact or launch a campaign.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close make a call"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#747878] transition-colors hover:bg-[#F5F4ED] disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5 sm:px-6">
          <label className="block font-['Space_Grotesk'] text-[12px] font-semibold text-[#444748]">
            Phone number
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="+91 98765 43210"
              className="mt-1.5 h-11 w-full rounded-[5px] border border-[#DCDDD6] bg-white px-3 font-['Space_Grotesk'] text-[13px] font-normal text-[#1B1C18] outline-none focus:border-[#7852D6]"
              required
            />
            <span className="mt-1 block font-['Space_Grotesk'] text-[10px] font-normal text-[#92938C]">Include + and your country code. Example: +919876543210.</span>
          </label>

          <label className="flex items-start gap-2.5 rounded-[5px] border border-[#ECEBE5] bg-[#FBFAF6] p-3 font-['Space_Grotesk'] text-[11px] leading-5 text-[#62645D]">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1 h-3.5 w-3.5 accent-[#7852D6]"
            />
            <span>I confirm that I have the recipient's permission or another valid legal basis to place this call.</span>
          </label>

          <div className="rounded-[5px] border border-[#E9E8E1] bg-[#FBFAF6] px-3 py-2.5 font-['Space_Grotesk'] text-[10px] leading-5 text-[#747878]">
            The call uses your workspace's saved AI agent settings. Workspace credit, daily-call and availability limits still apply. Direct calls currently have a two-minute maximum duration.
          </div>

          {error ? (
            <div role="alert" className="rounded-[5px] border border-[#F0D8D4] bg-[#FFF8F7] px-3 py-2.5 font-['Space_Grotesk'] text-[11px] leading-5 text-[#A33A32]">{error}</div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2 border-t border-[#ECEBE5] pt-4">
            <button type="button" onClick={onClose} disabled={busy} className="h-10 rounded-[5px] border border-[#DCDDD6] px-4 font-['Space_Grotesk'] text-[11px] font-semibold text-[#444748] hover:bg-[#F7F6F1] disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={busy || !phoneNumber.trim() || !confirmed} className="h-10 rounded-[5px] bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[11px] font-semibold text-white hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-50">
              {busy ? "Queuing call…" : "Confirm and call"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export function CallsDashboard({
  calls,
  total,
  filters,
  initialError,
}: {
  calls: CallRecord[];
  total: number;
  filters: CallFilters;
  initialError: string | null;
}) {
  const router = useRouter();
  const [callComposerOpen, setCallComposerOpen] = useState(false);
  const [callNotice, setCallNotice] = useState<string | null>(null);
  const connectedOnPage = calls.filter((call) => call.outcome === "connected").length;
  const followUpsOnPage = calls.filter((call) => call.followUpRequested).length;
  const creditsOnPage = calls.reduce((sum, call) => sum + call.creditsCharged, 0);
  const currentPage = Math.floor(filters.offset / filters.limit) + 1;
  const pageCount = Math.max(1, Math.ceil(total / filters.limit));
  const firstResult = total === 0 ? 0 : filters.offset + 1;
  const lastResult = Math.min(filters.offset + filters.limit, total);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.12em] text-[#9A8ABF]">
            Workspace / Activity
          </p>
          <h1 className="mt-1 font-['Newsreader'] text-[36px] leading-tight tracking-[-0.8px] text-[#1B1C18] sm:text-[42px]">
            Calls
          </h1>
          <p className="mt-2 max-w-[620px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#747878]">
            Review call outcomes, conversation summaries, recordings and AI-generated insights.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="purple">Call history</Badge>
          <button
            type="button"
            onClick={() => setCallComposerOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-[5px] bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[11px] font-semibold text-white transition-colors hover:bg-[#34352F]"
          >
            <span aria-hidden="true" className="text-[15px]">＋</span>
            Make a call
          </button>
        </div>
      </header>

      {callNotice ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-[#D7E8DA] bg-[#F1F8F2] px-4 py-3 font-['Space_Grotesk'] text-[11px] leading-5 text-[#397A55]">
          <span>{callNotice}</span>
          <button type="button" onClick={() => setCallNotice(null)} className="font-semibold">Dismiss</button>
        </div>
      ) : null}

      {initialError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-[#F0D8D4] bg-[#FFF8F7] px-4 py-3">
          <p className="font-['Space_Grotesk'] text-[12px] leading-5 text-[#A33A32]">
            Calls could not be loaded: {initialError}
          </p>
          <Link href="/dashboard/calls" className="rounded-[4px] border border-[#E5C7C3] bg-white px-3 py-2 font-['Space_Grotesk'] text-[11px] font-semibold text-[#8D3028]">
            Try again
          </Link>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Call metrics for current filter">
        <MetricCard label="Matching calls" value={formatNumber(total)} detail="Across all matching results" />
        <MetricCard label="Connected calls" value={formatNumber(connectedOnPage)} detail="On this page" />
        <MetricCard label="Follow-ups requested" value={formatNumber(followUpsOnPage)} detail="On this page" />
        <MetricCard label="Credits charged" value={formatNumber(creditsOnPage)} detail="On this page" />
      </section>

      <section className="overflow-hidden rounded-[8px] border border-[#ECEBE5] bg-white">
        <div className="border-b border-[#ECEBE5] p-4 sm:p-5">
          <div className="mb-4">
            <h2 className="font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">Call history</h2>
            <p className="mt-1 font-['Space_Grotesk'] text-[11px] text-[#85877F]">
              Search and filter calls recorded in this workspace.
            </p>
          </div>

          <form action="/dashboard/calls" method="get" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <label className="sm:col-span-2 xl:col-span-2">
              <span className="mb-1.5 block font-['Space_Grotesk'] text-[10px] font-semibold text-[#747878]">SEARCH</span>
              <input
                type="search"
                name="search"
                defaultValue={filters.search}
                placeholder="Contact, phone or summary"
                maxLength={200}
                className="h-10 w-full rounded-[5px] border border-[#E5E4DC] bg-[#FFFEFB] px-3 font-['Space_Grotesk'] text-[12px] text-[#1B1C18] outline-none focus:border-[#7852D6]"
              />
            </label>

            <label>
              <span className="mb-1.5 block font-['Space_Grotesk'] text-[10px] font-semibold text-[#747878]">OUTCOME</span>
              <select name="outcome" defaultValue={filters.outcome} className="h-10 w-full rounded-[5px] border border-[#E5E4DC] bg-[#FFFEFB] px-2.5 font-['Space_Grotesk'] text-[11px] text-[#1B1C18] outline-none focus:border-[#7852D6]">
                <option value="">All outcomes</option>
                <option value="connected">Connected</option>
                <option value="no_answer">No answer</option>
                <option value="busy">Busy</option>
                <option value="voicemail">Voicemail</option>
                <option value="dropped_early">Dropped early</option>
                <option value="failed">Failed</option>
              </select>
            </label>

            <label>
              <span className="mb-1.5 block font-['Space_Grotesk'] text-[10px] font-semibold text-[#747878]">SENTIMENT</span>
              <select name="sentiment" defaultValue={filters.sentiment} className="h-10 w-full rounded-[5px] border border-[#E5E4DC] bg-[#FFFEFB] px-2.5 font-['Space_Grotesk'] text-[11px] text-[#1B1C18] outline-none focus:border-[#7852D6]">
                <option value="">All sentiments</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
            </label>

            <label>
              <span className="mb-1.5 block font-['Space_Grotesk'] text-[10px] font-semibold text-[#747878]">INTEREST</span>
              <select name="interestLevel" defaultValue={filters.interestLevel} className="h-10 w-full rounded-[5px] border border-[#E5E4DC] bg-[#FFFEFB] px-2.5 font-['Space_Grotesk'] text-[11px] text-[#1B1C18] outline-none focus:border-[#7852D6]">
                <option value="">All levels</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>

            <label>
              <span className="mb-1.5 block font-['Space_Grotesk'] text-[10px] font-semibold text-[#747878]">FROM</span>
              <input type="date" name="startDate" defaultValue={filters.startDate} className="h-10 w-full rounded-[5px] border border-[#E5E4DC] bg-[#FFFEFB] px-2 font-['Space_Grotesk'] text-[11px] text-[#1B1C18] outline-none focus:border-[#7852D6]" />
            </label>

            <label>
              <span className="mb-1.5 block font-['Space_Grotesk'] text-[10px] font-semibold text-[#747878]">TO</span>
              <input type="date" name="endDate" defaultValue={filters.endDate} min={filters.startDate || undefined} className="h-10 w-full rounded-[5px] border border-[#E5E4DC] bg-[#FFFEFB] px-2 font-['Space_Grotesk'] text-[11px] text-[#1B1C18] outline-none focus:border-[#7852D6]" />
            </label>

            <input type="hidden" name="limit" value={filters.limit} />
            <div className="flex items-end gap-2 sm:col-span-2 xl:col-span-6">
              <button type="submit" className="h-10 rounded-[5px] bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[11px] font-semibold text-white hover:bg-[#34352F]">
                Apply filters
              </button>
              <Link href="/dashboard/calls" className="inline-flex h-10 items-center rounded-[5px] border border-[#DCDDD6] bg-white px-4 font-['Space_Grotesk'] text-[11px] font-semibold text-[#444748] hover:bg-[#F7F6F1]">
                Clear
              </Link>
            </div>
          </form>
        </div>

        {calls.length > 0 ? (
          <div className="divide-y divide-[#F0EFE9]">
            {calls.map((call) => {
              const outcomeTone = call.outcome === "connected" ? "green" : call.outcome === "failed" ? "red" : call.outcome === "busy" || call.outcome === "dropped_early" ? "amber" : "neutral";
              const interestTone = call.interestLevel === "high" ? "green" : call.interestLevel === "medium" ? "purple" : "neutral";

              return (
                <Link
                  key={call.id}
                  href={`/dashboard/calls/${encodeURIComponent(call.id)}`}
                  className="grid gap-3 px-4 py-4 transition-colors hover:bg-[#FFFEFB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7852D6] sm:px-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(130px,0.7fr)_minmax(150px,0.8fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                      {call.contactName || "Unknown contact"}
                    </p>
                    <p className="mt-1 truncate font-['Space_Grotesk'] text-[11px] text-[#747878]">
                      {call.phoneNumber || "No phone number"}
                      {call.campaignName ? ` · ${call.campaignName}` : ""}
                    </p>
                    <p className="mt-1 font-['Space_Grotesk'] text-[10px] text-[#92938C]">{formatDate(call.startedAt)}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={outcomeTone}>{OUTCOME_LABELS[call.outcome] ?? call.outcome.replaceAll("_", " ")}</Badge>
                    {call.followUpRequested ? <Badge tone="purple">Follow-up</Badge> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {call.interestLevel ? <Badge tone={interestTone}>{call.interestLevel} interest</Badge> : null}
                    {call.sentiment ? <Badge tone={call.sentiment === "positive" ? "green" : call.sentiment === "negative" ? "red" : "neutral"}>{call.sentiment}</Badge> : null}
                  </div>

                  <div className="flex items-center justify-between gap-4 lg:justify-end">
                    <div className="text-left lg:text-right">
                      <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">{formatDuration(call.durationSeconds)}</p>
                      <p className="mt-1 font-['Space_Grotesk'] text-[10px] text-[#92938C]">{formatNumber(call.creditsCharged)} credits</p>
                    </div>
                    <span className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#7852D6]">Details →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F2EEFA] text-[#705AA8]">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6.5 3.5h3l1.5 4-2 1.8a15 15 0 0 0 5.7 5.7l1.8-2 4 1.5v3c0 1.1-.9 2-2 2A15.5 15.5 0 0 1 4.5 5.5c0-1.1.9-2 2-2Z" />
              </svg>
            </span>
            <h3 className="mt-4 font-['Newsreader'] text-[25px] text-[#1B1C18]">{total === 0 ? "No calls recorded yet" : "No calls match these filters"}</h3>
            <p className="mt-2 max-w-[390px] font-['Space_Grotesk'] text-[11px] leading-5 text-[#85877F]">
              {total === 0 ? "Completed calls will appear here with their outcomes, summaries and conversation details." : "Try changing your search, date range or filters."}
            </p>
            {total === 0 ? (
              <p className="mt-3 font-['Space_Grotesk'] text-[10px] text-[#92938C]">Test calls and campaign calls are recorded here after completion.</p>
            ) : (
              <Link href="/dashboard/calls" className="mt-4 rounded-[5px] border border-[#DCDDD6] px-4 py-2 font-['Space_Grotesk'] text-[11px] font-semibold text-[#444748]">Clear filters</Link>
            )}
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECEBE5] px-4 py-3 sm:px-5">
          <p className="font-['Space_Grotesk'] text-[10px] text-[#85877F]">
            Showing {formatNumber(firstResult)}–{formatNumber(lastResult)} of {formatNumber(total)} calls
          </p>
          <div className="flex items-center gap-2">
            <Link
              aria-disabled={filters.offset <= 0}
              tabIndex={filters.offset <= 0 ? -1 : 0}
              href={filterHref(filters, { offset: Math.max(0, filters.offset - filters.limit) })}
              className={`rounded-[5px] border px-3 py-2 font-['Space_Grotesk'] text-[10px] font-semibold ${filters.offset <= 0 ? "pointer-events-none border-[#ECEBE5] text-[#B7B8B2]" : "border-[#DCDDD6] text-[#444748] hover:bg-[#F7F6F1]"}`}
            >
              Previous
            </Link>
            <span className="min-w-[70px] text-center font-['Space_Grotesk'] text-[10px] text-[#747878]">Page {currentPage} / {pageCount}</span>
            <Link
              aria-disabled={filters.offset + filters.limit >= total}
              tabIndex={filters.offset + filters.limit >= total ? -1 : 0}
              href={filterHref(filters, { offset: filters.offset + filters.limit })}
              className={`rounded-[5px] border px-3 py-2 font-['Space_Grotesk'] text-[10px] font-semibold ${filters.offset + filters.limit >= total ? "pointer-events-none border-[#ECEBE5] text-[#B7B8B2]" : "border-[#DCDDD6] text-[#444748] hover:bg-[#F7F6F1]"}`}
            >
              Next
            </Link>
          </div>
        </footer>
      </section>

      {callComposerOpen ? (
        <CallComposer
          onClose={() => setCallComposerOpen(false)}
          onQueued={(message) => {
            setCallComposerOpen(false);
            setCallNotice(message);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
