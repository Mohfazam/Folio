"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useDashboardProfile } from "@/components/dashboard/dashboard-shell";

export type JsonRecord = Record<string, unknown>;

export type AnalyticsOverview = {
  timeframe: string;
  client: JsonRecord;
  quota: JsonRecord;
  callMetrics: JsonRecord;
  leadIntelligence: JsonRecord;
  pipeline: JsonRecord;
  costs: JsonRecord;
  recentCalls: JsonRecord[];
};

export type CollectionSnapshot = {
  items: JsonRecord[];
  total: number | null;
  itemsKnown: boolean;
};

type LoadResult<T> =
  | { state: "ready"; data: T }
  | { state: "error"; error: string; status?: number };

export type DashboardOverviewData = {
  analytics: LoadResult<AnalyticsOverview>;
  contacts: LoadResult<CollectionSnapshot>;
  campaigns: LoadResult<CollectionSnapshot>;
  followUps: LoadResult<CollectionSnapshot>;
  knowledgeBase: LoadResult<CollectionSnapshot>;
  businessProfile: LoadResult<JsonRecord | null>;
};

type SetupStatus = "complete" | "incomplete" | "unverified";

type SetupStep = {
  id: number;
  title: string;
  description: string;
  detail: string;
  action: string;
  status: SetupStatus;
  evidence: string;
  recommended?: boolean;
};

function Icon({
  kind,
  className = "h-4 w-4",
}: {
  kind: "calls" | "conversation" | "followup" | "queue" | "contacts" | "campaign" | "voice" | "clock" | "check" | "arrow" | "alert" | "credit";
  className?: string;
}) {
  const paths: Record<typeof kind, ReactNode> = {
    calls: <><path d="M6.5 3.5h3l1.5 4-2 1.8a15 15 0 0 0 5.7 5.7l1.8-2 4 1.5v3c0 1.1-.9 2-2 2A15.5 15.5 0 0 1 4.5 5.5c0-1.1.9-2 2-2Z" /></>,
    conversation: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></>,
    followup: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6" /></>,
    queue: <><path d="M4 6h16M4 12h16M4 18h10" /><circle cx="18" cy="18" r="2" /></>,
    contacts: <><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.2 2.6-5 6-5s6 1.8 6 5M17 5a3 3 0 0 1 0 6M18 15c2 .5 3 2 3 4" /></>,
    campaign: <><path d="M3 11v2a2 2 0 0 0 2 2h2l3 5h2l-2-6" /><path d="M7 9 19 4v16L7 15z" /></>,
    voice: <><path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    alert: <><path d="M12 3 2.8 20h18.4L12 3Z" /><path d="M12 9v5M12 17h.01" /></>,
    credit: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  };

  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[kind]}
    </svg>
  );
}

function recordText(record: JsonRecord | null | undefined, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function recordNumber(record: JsonRecord | null | undefined, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-IN") : "—";
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

function formatDate(value: unknown, timezone: string): string {
  if (typeof value !== "string" && !(value instanceof Date)) return "Time unavailable";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
}

function getCampaignStatusCounts(snapshot: CollectionSnapshot | null) {
  const rows = snapshot?.items ?? [];
  return {
    active: rows.filter((item) => recordText(item, "status") === "active").length,
    draft: rows.filter((item) => recordText(item, "status") === "draft").length,
    paused: rows.filter((item) => recordText(item, "status") === "paused").length,
    completed: rows.filter((item) => recordText(item, "status") === "completed").length,
  };
}

function buildSetupSteps(data: DashboardOverviewData): SetupStep[] {
  const profile = data.businessProfile.state === "ready" ? data.businessProfile.data : null;
  const contacts = data.contacts.state === "ready" ? data.contacts.data : null;
  const campaigns = data.campaigns.state === "ready" ? data.campaigns.data : null;
  const campaignCounts = getCampaignStatusCounts(campaigns);

  const voiceConfigured = Boolean(
    profile &&
    recordText(profile, "aiPersonaName") &&
    recordText(profile, "toneOfVoice") &&
    Array.isArray(profile.guardrails) &&
    profile.guardrails.length > 0,
  );
  const contactsImported = contacts?.total !== null && contacts?.total !== undefined && contacts.total > 0;
  const campaignCreated = campaigns?.total !== null && campaigns?.total !== undefined && campaigns.total > 0;
  const campaignLaunched = campaigns?.itemsKnown === true && campaignCounts.active > 0;

  return [
    {
      id: 1,
      title: "Configure voice persona & guardrails",
      description: "Set the assistant's tone, identity, and business boundaries.",
      detail: "This status is checked against the saved business profile. A profile without a persona, tone, and guardrails is not counted as complete.",
      action: "Review voice setup",
      status: data.businessProfile.state === "error" ? "unverified" : voiceConfigured ? "complete" : "incomplete",
      evidence: data.businessProfile.state === "error"
        ? `Business profile unavailable: ${data.businessProfile.error}`
        : voiceConfigured ? "Business profile contains a persona, tone, and guardrails." : "Business profile or required voice settings are missing.",
      recommended: !voiceConfigured,
    },
    {
      id: 2,
      title: "Connect your CRM or import contacts",
      description: "Bring contact records into your workspace before starting outbound activity.",
      detail: "Foolioo reads the saved contacts total from your workspace. Opted-out records remain governed by the backend's contact eligibility rules.",
      action: "Review contacts",
      status: data.contacts.state === "error" || contacts?.total === null ? "unverified" : contactsImported ? "complete" : "incomplete",
      evidence: data.contacts.state === "error" ? `Contacts unavailable: ${data.contacts.error}` : `${formatNumber(contacts?.total)} contacts in this workspace.`,
    },
    {
      id: 3,
      title: "Place a simulated test call",
      description: "Verify the voice experience and handoff behavior before contacting your audience.",
      detail: "The registered frontend API does not expose a test-call creation or test-call identification operation. Recent call records alone cannot prove that a call was a simulation.",
      action: "Test call status unavailable",
      status: "unverified",
      evidence: "No test-call status is exposed by the current API contract.",
    },
    {
      id: 4,
      title: "Create your first outbound campaign",
      description: "Define an audience, objective, and conversation flow.",
      detail: "Campaign setup is checked against the real campaign records in this workspace.",
      action: "Review campaigns",
      status: data.campaigns.state === "error" || campaigns?.total === null ? "unverified" : campaignCreated ? "complete" : "incomplete",
      evidence: data.campaigns.state === "error" ? `Campaigns unavailable: ${data.campaigns.error}` : `${formatNumber(campaigns?.total)} campaigns saved.`,
    },
    {
      id: 5,
      title: "Set up team routing & follow-up rules",
      description: "Define how callbacks and conversations requiring human attention are handled.",
      detail: "The current route registry exposes follow-up records, but it does not expose a read endpoint for the routing-rule configuration itself. Existing follow-ups do not prove that routing rules are configured.",
      action: "Routing status unavailable",
      status: "unverified",
      evidence: "Routing-rule configuration is not exposed by the current API contract.",
    },
    {
      id: 6,
      title: "Launch your first outbound campaign",
      description: "Activate a campaign after the workspace is ready.",
      detail: "This check requires a campaign record with status 'active'. Draft, paused, and completed campaigns are not counted as currently launched.",
      action: "Review active campaigns",
      status: data.campaigns.state === "error" || campaigns?.itemsKnown !== true ? "unverified" : campaignLaunched ? "complete" : "incomplete",
      evidence: data.campaigns.state === "error" ? `Campaigns unavailable: ${data.campaigns.error}` : campaigns?.itemsKnown !== true ? "Campaign statuses could not be verified from the response." : `${formatNumber(campaignCounts.active)} active campaigns.`,
    },
  ];
}

function ProgressRing({ complete, total }: { complete: number; total: number }) {
  const percentage = total > 0 ? (complete / total) * 100 : 0;
  return (
    <div
      className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#644ABB ${percentage * 3.6}deg, #E9E8E1 0deg)` }}
      role="img"
      aria-label={`${complete} of ${total} setup steps verified complete`}
    >
      <div className="absolute inset-[4px] flex items-center justify-center rounded-full bg-[#F8F7F2] font-['Space_Grotesk'] text-[11px] font-bold tracking-[0.06em] text-[#1B1C18]">{complete}/{total}</div>
    </div>
  );
}

function SetupChecklist({ data }: { data: DashboardOverviewData }) {
  const steps = useMemo(() => buildSetupSteps(data), [data]);
  const [expanded, setExpanded] = useState<number[]>([1]);
  const complete = steps.filter((step) => step.status === "complete").length;
  const unverified = steps.filter((step) => step.status === "unverified").length;
  const allExpanded = expanded.length === steps.length;
  const toggleAll = () => setExpanded(allExpanded ? [] : steps.map((step) => step.id));
  const toggleStep = (id: number) => {
    setExpanded((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <section className="overflow-hidden rounded-[8px] border border-[#E9E8E1] bg-white pb-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]" aria-labelledby="setup-heading">
      <div className="flex flex-col gap-4 bg-[rgba(245,244,237,0.55)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-4">
          <ProgressRing complete={complete} total={steps.length} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="setup-heading" className="font-['Space_Grotesk'] text-[15px] font-semibold tracking-[-0.16px] text-[#1B1C18] sm:text-[16px]">Get your workspace ready for outbound voice</h2>
              <span className="rounded-[2px] bg-[#FFEBE8] px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-medium tracking-[0.04em] text-[#A33A32]">{complete === steps.length ? "Setup verified" : "Setup in progress"}</span>
            </div>
            <p className="mt-1 font-['Space_Grotesk'] text-[12px] leading-5 text-[#444748] sm:text-[13px]">
              {complete} of 6 steps verified from workspace records. {unverified} {unverified === 1 ? "step needs" : "steps need"} an API-backed verification signal.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:justify-end">
          <button type="button" onClick={toggleAll} className="rounded-[2px] px-3 py-1.5 font-['Space_Grotesk'] text-[12px] font-medium text-[#444748] transition-colors hover:bg-white">{allExpanded ? "Collapse all steps" : "Expand all steps"}</button>
          <span className="inline-flex items-center gap-1.5 rounded-[12px] bg-[#E7DEFF] px-3 py-1.5 font-['Space_Grotesk'] text-[10px] font-semibold tracking-[0.06em] text-[#644ABB]">LIVE WORKSPACE STATUS</span>
        </div>
      </div>

      <div className="flex flex-col px-4 pt-2 sm:px-6">
        {steps.map((step) => {
          const isExpanded = expanded.includes(step.id);
          const statusText = step.status === "complete" ? "Verified" : step.status === "unverified" ? "Not verifiable" : "Needs setup";
          const statusStyle = step.status === "complete" ? "bg-[#E8F3EA] text-[#25633A]" : step.status === "unverified" ? "bg-[#F1F0EB] text-[#666A68]" : "bg-[#FFEBE8] text-[#A33A32]";
          return (
            <article key={step.id} className={`border-b border-[#ECEBE5] last:border-b-0 ${step.recommended && isExpanded ? "my-1 rounded-[4px] border-0 bg-[#F5F4ED] px-3" : "px-3"}`}>
              <div className="flex items-start gap-3 py-4 sm:items-center sm:gap-4">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-white ${step.status === "complete" ? "border-[#6BA77A] text-[#25633A]" : "border-[#D5D5CE] text-transparent"}`} aria-hidden="true">
                  {step.status === "complete" ? <Icon kind="check" className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-transparent" />}
                </span>
                <button type="button" onClick={() => toggleStep(step.id)} aria-expanded={isExpanded} className="min-w-0 flex-1 text-left">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={`font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.07em] ${step.recommended ? "text-[#644ABB]" : "text-[#747878]"}`}>STEP {step.id}{step.recommended ? " · RECOMMENDED NEXT" : ""}</span>
                    <span className="hidden h-1 w-1 rounded-full bg-[#C4C7C7] sm:inline-block" />
                    <span className="font-['Space_Grotesk'] text-[14px] font-semibold leading-5 text-[#1B1C18] sm:text-[15px]">{step.title}</span>
                  </span>
                  <span className="mt-1 block max-w-[620px] font-['Space_Grotesk'] text-[12px] leading-[20px] text-[#565B5B]">{step.description}</span>
                </button>
                <span className={`hidden shrink-0 rounded-[2px] px-2 py-1 font-['Space_Grotesk'] text-[10px] font-medium sm:inline-flex ${statusStyle}`}>{statusText}</span>
                <button type="button" onClick={() => toggleStep(step.id)} aria-label={`${isExpanded ? "Collapse" : "Expand"} ${step.title}`} className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] text-[#747878] hover:bg-white sm:hidden"><span className={`text-[18px] leading-none transition-transform ${isExpanded ? "rotate-45" : ""}`}>+</span></button>
                <button type="button" onClick={() => setExpanded((current) => current.includes(step.id) ? current : [...current, step.id])} className="hidden shrink-0 items-center gap-2 rounded-[4px] bg-[#1B1C18] px-3.5 py-2 font-['Space_Grotesk'] text-[12px] font-medium text-white transition-colors hover:bg-[#34352F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] focus-visible:ring-offset-2 sm:inline-flex">Details<Icon kind="arrow" className="h-3 w-3" /></button>
              </div>
              {isExpanded ? (
                <div className="pb-4 pl-8 sm:pl-9">
                  <p className="max-w-[720px] font-['Space_Grotesk'] text-[12px] leading-[20px] text-[#565B5B]">{step.detail}</p>
                  <div className="mt-3 flex flex-col gap-2 rounded-[3px] bg-white p-3 shadow-[0_1px_1px_rgba(0,0,0,0.05)] sm:flex-row sm:items-center">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] ${step.status === "complete" ? "bg-[#E8F3EA] text-[#25633A]" : "bg-[#F1F0EB] text-[#666A68]"}`}><Icon kind={step.status === "complete" ? "check" : "alert"} className="h-4 w-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-['Space_Grotesk'] text-[10px] font-semibold uppercase tracking-[0.06em] text-[#747878]">Backend verification</span>
                      <span className="block font-['Space_Grotesk'] text-[12px] font-medium text-[#1B1C18]">{step.evidence}</span>
                    </span>
                    <span className={`self-start rounded-[2px] px-2 py-1 font-['Space_Grotesk'] text-[10px] font-medium sm:self-center ${statusStyle}`}>{statusText}</span>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: number | null;
  helper: string;
  icon: "calls" | "conversation" | "followup" | "queue";
}) {
  return (
    <article className="flex min-h-[128px] flex-col justify-between rounded-[8px] bg-[rgba(245,244,237,0.7)] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-['Space_Grotesk'] text-[12px] font-medium text-[#444748] sm:text-[13px]">{label}</h3>
        <span className="text-[#747878]"><Icon kind={icon} className="h-4 w-4" /></span>
      </div>
      <div>
        <p className="font-['Newsreader'] text-[30px] leading-9 text-[#1B1C18]">{value === null ? "—" : formatNumber(value)}</p>
        <p className="mt-1 font-['Space_Grotesk'] text-[10px] font-semibold leading-[14px] tracking-[0.03em] text-[#747878]">{helper}</p>
      </div>
    </article>
  );
}

function SectionError({ title, error }: { title: string; error: string }) {
  return (
    <div className="rounded-[6px] border border-[#F0D8D4] bg-[#FFF9F8] px-3 py-3">
      <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#8D3028]">{title} could not be loaded</p>
      <p className="mt-1 break-words font-['Space_Grotesk'] text-[11px] leading-5 text-[#8D5A55]">{error}</p>
    </div>
  );
}

function QuotaPanel({ analytics }: { analytics: AnalyticsOverview }) {
  const allowance = recordNumber(analytics.quota, "monthlyCreditsAllowance");
  const used = recordNumber(analytics.quota, "creditsUsedThisCycle");
  const reserved = recordNumber(analytics.quota, "creditsReservedThisCycle");
  const remaining = recordNumber(analytics.quota, "creditsRemaining");
  const percentUsed = allowance && used !== null ? Math.min(100, Math.max(0, (used / allowance) * 100)) : 0;

  return (
    <section className="rounded-[8px] border border-[#E9E8E1] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-6" aria-labelledby="quota-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-['Space_Grotesk'] text-[10px] font-bold tracking-[0.08em] text-[#747878]">WORKSPACE CAPACITY</p>
          <h2 id="quota-heading" className="mt-1 font-['Newsreader'] text-[21px] font-semibold text-[#1B1C18]">Voice credits</h2>
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#E7DEFF] text-[#644ABB]"><Icon kind="credit" className="h-4 w-4" /></span>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="font-['Newsreader'] text-[30px] leading-9 text-[#1B1C18]">{formatNumber(remaining)}</p>
          <p className="mt-1 font-['Space_Grotesk'] text-[11px] text-[#747878]">Credits remaining this cycle</p>
        </div>
        <p className="font-['Space_Grotesk'] text-[11px] font-medium text-[#444748]">{formatNumber(allowance)} allowance</p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#EFEEE7]" role="progressbar" aria-label="Monthly voice credits used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percentUsed)}>
        <div className="h-full rounded-full bg-[#7852D6] transition-[width]" style={{ width: `${percentUsed}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap justify-between gap-2 font-['Space_Grotesk'] text-[10px] text-[#747878]">
        <span>{formatNumber(used)} used</span>
        <span>{formatNumber(reserved)} reserved</span>
        <span>{formatNumber(recordNumber(analytics.quota, "callsRemainingToday"))} calls left today</span>
      </div>
    </section>
  );
}

function RecentCalls({ analytics, timezone }: { analytics: AnalyticsOverview; timezone: string }) {
  const recentCalls = analytics.recentCalls;
  return (
    <section className="rounded-[8px] border border-[#E9E8E1] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]" aria-labelledby="recent-calls-heading">
      <div className="flex items-center justify-between border-b border-[#ECEBE5] px-5 py-4 sm:px-6">
        <div>
          <p className="font-['Space_Grotesk'] text-[10px] font-bold tracking-[0.08em] text-[#747878]">LATEST ACTIVITY</p>
          <h2 id="recent-calls-heading" className="mt-1 font-['Newsreader'] text-[21px] font-semibold text-[#1B1C18]">Recent calls</h2>
        </div>
        <span className="rounded-[12px] bg-[#F1F0EB] px-3 py-1 font-['Space_Grotesk'] text-[10px] font-semibold text-[#565B5B]">Last 5 records</span>
      </div>
      {recentCalls.length === 0 ? (
        <div className="px-6 py-9 text-center">
          <p className="font-['Space_Grotesk'] text-[13px] font-medium text-[#444748]">No calls recorded yet</p>
          <p className="mt-1 font-['Space_Grotesk'] text-[11px] text-[#747878]">New call activity from your workspace will appear here.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#ECEBE5]">
          {recentCalls.map((call, index) => {
            const outcome = recordText(call, "outcome") ?? "unknown";
            const connected = outcome === "connected";
            const contactName = recordText(call, "contactName") ?? recordText(call, "phoneNumber") ?? "Unknown contact";
            const summary = recordText(call, "summary");
            return (
              <article key={recordText(call, "id") ?? `${outcome}-${index}`} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] ${connected ? "bg-[#E8F3EA] text-[#25633A]" : "bg-[#F1F0EB] text-[#666A68]"}`}><Icon kind={connected ? "conversation" : "calls"} className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">{contactName}</p>
                  <p className="mt-0.5 line-clamp-1 font-['Space_Grotesk'] text-[11px] text-[#747878]">{summary ?? formatDate(call.startedAt, timezone)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-1">
                  <span className={`rounded-[2px] px-2 py-1 font-['Space_Grotesk'] text-[10px] font-semibold capitalize ${connected ? "bg-[#E8F3EA] text-[#25633A]" : "bg-[#F1F0EB] text-[#666A68]"}`}>{outcome.replaceAll("_", " ")}</span>
                  <span className="font-['Space_Grotesk'] text-[10px] text-[#929493]">{formatDuration(recordNumber(call, "durationSeconds"))} · {formatDate(call.startedAt, timezone)}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function WorkspaceSnapshot({ data }: { data: DashboardOverviewData }) {
  const contactTotal = data.contacts.state === "ready" ? data.contacts.data.total : null;
  const campaigns = data.campaigns.state === "ready" ? data.campaigns.data : null;
  const campaignCounts = getCampaignStatusCounts(campaigns);
  const followUpTotal = data.followUps.state === "ready" ? data.followUps.data.total : null;
  const knowledgeTotal = data.knowledgeBase.state === "ready" ? data.knowledgeBase.data.total : null;

  const rows = [
    { label: "Contacts in workspace", value: contactTotal, error: data.contacts.state === "error" ? data.contacts.error : null },
    { label: "Saved campaigns", value: campaigns?.total ?? null, error: data.campaigns.state === "error" ? data.campaigns.error : null },
    { label: "Active campaigns", value: campaigns?.itemsKnown ? campaignCounts.active : null, error: data.campaigns.state === "error" ? data.campaigns.error : null },
    { label: "Follow-up records", value: followUpTotal, error: data.followUps.state === "error" ? data.followUps.error : null },
    { label: "Knowledge entries", value: knowledgeTotal, error: data.knowledgeBase.state === "error" ? data.knowledgeBase.error : null },
  ];

  return (
    <section className="rounded-[8px] border border-[#E9E8E1] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-6" aria-labelledby="workspace-snapshot-heading">
      <div className="pb-3">
        <p className="font-['Space_Grotesk'] text-[10px] font-bold tracking-[0.08em] text-[#747878]">LIVE WORKSPACE RECORDS</p>
        <h2 id="workspace-snapshot-heading" className="mt-1 font-['Newsreader'] text-[21px] font-semibold text-[#1B1C18]">Workspace snapshot</h2>
      </div>
      <div className="divide-y divide-[#ECEBE5]">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 py-3">
            <span className="font-['Space_Grotesk'] text-[12px] text-[#444748]">{row.label}</span>
            <div className="flex items-center gap-3">
              {row.error ? <span className="max-w-[150px] truncate font-['Space_Grotesk'] text-[10px] text-[#A33A32]" title={row.error}>Unavailable</span> : <span className="font-['Newsreader'] text-[22px] text-[#1B1C18]">{formatNumber(row.value)}</span>}
              <span className="hidden text-[#B8B9B5] sm:inline-flex"><Icon kind="arrow" className="h-3 w-3" /></span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 font-['Space_Grotesk'] text-[10px] leading-4 text-[#929493]">Counts come from workspace endpoints. Section pages will be built in the next dashboard pass.</p>
    </section>
  );
}

export function OverviewDashboard({ data }: { data: DashboardOverviewData }) {
  const profile = useDashboardProfile();
  const firstName = profile.displayName.trim().split(/\s+/)[0] || "there";
  const workspaceCode = profile.workspaceId ? profile.workspaceId.slice(-6).toUpperCase() : null;
  const analytics = data.analytics.state === "ready" ? data.analytics.data : null;
  const callMetrics = analytics?.callMetrics;
  const pipeline = analytics?.pipeline;
  const campaignCount = data.campaigns.state === "ready" ? data.campaigns.data.total : null;
  const timezone = profile.timezone || "Asia/Kolkata";
  const telemetryLabel = analytics ? `LAST ${analytics.timeframe.toUpperCase()}` : "ANALYTICS UNAVAILABLE";

  return (
    <div className="flex flex-col">
      <header className="pb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="rounded-[2px] bg-[rgba(231,222,255,0.65)] px-2.5 py-1 font-['Space_Grotesk'] text-[10px] font-bold tracking-[0.1em] text-[#644ABB]">WORKSPACE OVERVIEW</span>
          {workspaceCode ? <span className="font-['Space_Grotesk'] text-[10px] font-medium tracking-[0.05em] text-[#747878]">Workspace ID: {workspaceCode}</span> : null}
        </div>
        <h1 className="font-['Newsreader'] text-[34px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[40px]">{profile.greeting}, {firstName}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-['Space_Grotesk'] text-[12px] leading-[22px] text-[#444748] sm:text-[13px]">
          <span>Welcome to your Foolioo workspace</span><span className="h-1 w-1 rounded-full bg-[#C4C7C7]" /><span className="font-medium text-[#1B1C18]">{profile.workspaceName}</span><span className="h-1 w-1 rounded-full bg-[#C4C7C7]" /><span>{timezone}</span>
        </div>
      </header>

      <SetupChecklist data={data} />

      <section className="pt-8" aria-labelledby="metrics-heading">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
          <h2 id="metrics-heading" className="font-['Space_Grotesk'] text-[10px] font-bold tracking-[0.08em] text-[#747878]">WORKSPACE METRICS</h2>
          <span className="font-['Space_Grotesk'] text-[10px] font-semibold tracking-[0.06em] text-[#747878]">{telemetryLabel}</span>
        </div>
        {data.analytics.state === "error" ? (
          <SectionError title="Workspace analytics" error={data.analytics.error} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Calls placed" value={recordNumber(callMetrics, "totalCalls")} helper="Calls in the selected period" icon="calls" />
            <MetricCard label="Connected calls" value={recordNumber(callMetrics, "connectedCalls")} helper={`${recordNumber(callMetrics, "connectionRatePercent") ?? 0}% connection rate`} icon="conversation" />
            <MetricCard label="Open follow-ups" value={recordNumber(pipeline, "openFollowUps")} helper="Follow-up records with open status" icon="followup" />
            <MetricCard label="Pending queue" value={recordNumber(pipeline, "pendingInQueue")} helper={`${formatNumber(recordNumber(pipeline, "inProgress"))} currently in progress`} icon="queue" />
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 pt-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)]">
        {analytics ? <RecentCalls analytics={analytics} timezone={timezone} /> : <div className="rounded-[8px] border border-[#E9E8E1] bg-white p-5"><p className="font-['Space_Grotesk'] text-[12px] text-[#747878]">Recent calls are unavailable until analytics loads.</p></div>}
        {analytics ? <QuotaPanel analytics={analytics} /> : null}
      </section>

      <section className="pt-6">
        <WorkspaceSnapshot data={data} />
      </section>

      {data.analytics.state === "ready" ? (
        <section className="grid grid-cols-1 gap-3 pt-6 sm:grid-cols-3" aria-label="Additional analytics">
          <div className="rounded-[8px] bg-[rgba(245,244,237,0.7)] p-4">
            <p className="font-['Space_Grotesk'] text-[10px] font-semibold tracking-[0.07em] text-[#747878]">HIGH-INTENT LEADS</p>
            <p className="mt-2 font-['Newsreader'] text-[26px] text-[#1B1C18]">{formatNumber(recordNumber(analytics.leadIntelligence, "highInterestCount"))}</p>
          </div>
          <div className="rounded-[8px] bg-[rgba(245,244,237,0.7)] p-4">
            <p className="font-['Space_Grotesk'] text-[10px] font-semibold tracking-[0.07em] text-[#747878]">FOLLOW-UPS REQUESTED ON CALLS</p>
            <p className="mt-2 font-['Newsreader'] text-[26px] text-[#1B1C18]">{formatNumber(recordNumber(analytics.leadIntelligence, "followUpsRequestedCount"))}</p>
          </div>
          <div className="rounded-[8px] bg-[rgba(245,244,237,0.7)] p-4">
            <p className="font-['Space_Grotesk'] text-[10px] font-semibold tracking-[0.07em] text-[#747878]">ACTIVE CAMPAIGNS</p>
            <p className="mt-2 font-['Newsreader'] text-[26px] text-[#1B1C18]">{formatNumber(campaignCount)}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
