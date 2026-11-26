"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { exportAnalyticsToPdf } from "@/lib/utils/export-analytics-pdf";

type Row = Record<string, unknown>;
export type AnalyticsData = {
  timeframe: string;
  client?: Row;
  quota?: Row;
  callMetrics?: Row;
  leadIntelligence?: Row;
  pipeline?: Row;
  costs?: Row;
  recentCalls?: Row[];
  dailyTrend?: Row[];
  campaignPerformance?: Row[];
};

const number = (row: Row | undefined, key: string) => typeof row?.[key] === "number" && Number.isFinite(row[key]) ? row[key] as number : 0;
const money = (value: number) => `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const duration = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
const percent = (part: number, total: number) => total ? `${((part / total) * 100).toFixed(1)}%` : "0%";
const panel = "rounded-[8px] border border-[#ECEBE5] bg-white p-4 sm:p-5";

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="rounded-[8px] border border-[#ECEBE5] bg-[#FFFEFB] px-4 py-4"><p className="font-['Space_Grotesk'] text-[13px] text-[#747878]">{label}</p><p className="mt-2 font-['Newsreader'] text-[32px] leading-none tracking-[-.5px] text-[#1B1C18]">{value}</p><p className="mt-2 font-['Space_Grotesk'] text-[12px] text-[#92938C]">{note}</p></div>;
}

function TrendChart({ rows }: { rows: Row[] }) {
  const values = rows.slice(-14);
  const max = Math.max(1, ...values.map((row) => number(row, "totalCalls")));
  if (!values.length) return <div className="flex h-52 items-center justify-center text-[14px] text-[#92938C]">No call activity in this period.</div>;
  return <div className="flex h-56 items-end gap-2 border-b border-l border-[#EAE9E2] px-2 pb-2 pt-5">{values.map((row, index) => {
    const total = number(row, "totalCalls");
    const connected = number(row, "connectedCalls");
    const height = Math.max(3, (total / max) * 100);
    const connectedHeight = total ? (connected / total) * height : 0;
    const date = typeof row.date === "string" ? new Date(`${row.date}T00:00:00`) : null;
    const label = date && Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(date) : "";
    return <div key={`${String(row.date)}-${index}`} className="group flex h-full min-w-0 flex-1 flex-col justify-end" title={`${label}: ${total} calls, ${connected} connected`}><div className="relative mx-auto w-full max-w-9 overflow-hidden rounded-t-[3px] bg-[#EAE5F7]" style={{ height: `${height}%` }}><div className="absolute inset-x-0 bottom-0 rounded-t-[3px] bg-[#7655C7]" style={{ height: `${total ? (connected / total) * 100 : 0}%` }} /></div><span className="mt-2 truncate text-center font-['Space_Grotesk'] text-[11px] text-[#92938C]">{values.length <= 7 || index % 2 === 0 ? label : ""}</span></div>;
  })}</div>;
}

function BreakdownRow({ label, value, total, color = "bg-[#7655C7]" }: { label: string; value: number; total: number; color?: string }) {
  const width = total ? Math.max(0, (value / total) * 100) : 0;
  return <div><div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]"><span className="text-[#656861]">{label}</span><span className="font-semibold tabular-nums text-[#252620]">{value.toLocaleString("en-IN")}</span></div><div className="h-2 overflow-hidden rounded-full bg-[#F0EFE9]"><div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} /></div></div>;
}

export function AnalyticsDashboard({ timeframe, data, error }: { timeframe: string; data: AnalyticsData | null; error: string | null }) {
  const router = useRouter();
  const [selectedTimeframe, setSelectedTimeframe] = useState(timeframe);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  useEffect(() => {
    setSelectedTimeframe(timeframe);
  }, [timeframe]);

  useEffect(() => {
    if (!exportNotice) return;
    const timer = window.setTimeout(() => {
      setExportNotice(null);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [exportNotice]);
  const metrics = data?.callMetrics;
  const leads = data?.leadIntelligence;
  const costs = data?.costs;
  const total = number(metrics, "totalCalls");
  const connected = number(metrics, "connectedCalls");
  const unanswered = number(metrics, "unansweredCalls");
  const failed = number(metrics, "failedCalls");
  const interestTotal = number(leads, "highInterestCount") + number(leads, "mediumInterestCount") + number(leads, "lowInterestCount");
  const sentiments = (leads?.sentiments && typeof leads.sentiments === "object" ? leads.sentiments : {}) as Row;
  const campaignRows = data?.campaignPerformance ?? [];
  const trendRows = data?.dailyTrend ?? [];

  return <main className="space-y-5 pb-8">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><h1 className="mt-2 font-['Newsreader'] text-[36px] leading-[1.12] tracking-[-0.7px] text-[#1B1C18] sm:text-[42px]">Analytics</h1><p className="mt-2 max-w-xl font-['Space_Grotesk'] text-[14px] leading-[1.55] text-[#777970]">Understand call activity, campaign outcomes, lead quality and operating costs.</p></div>
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex items-center gap-3 font-['Space_Grotesk'] text-[13px] text-[#747878]">
          Date range
          <select value={selectedTimeframe} onChange={(event) => { const nextFrame = event.target.value; setSelectedTimeframe(nextFrame); router.push(`/dashboard/analytics?timeframe=${nextFrame}`); router.refresh(); }} className="h-10 rounded-[6px] border border-[#DCDDD6] bg-white px-3 text-[14px] font-medium text-[#252620] outline-none focus:border-[#7655C7]">
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="all">All time</option>
          </select>
        </label>
        <button
          type="button"
          disabled={!data}
          onClick={() => {
            if (!data) return;
            setExportNotice(null);
            const ok = exportAnalyticsToPdf(selectedTimeframe, data);
            if (!ok) {
              setExportNotice("Unable to generate the PDF report right now. Please try again.");
            } else {
              setExportNotice("Downloaded foolioo-analytics-" + (selectedTimeframe || "30d") + ".pdf");
            }
          }}
          className="inline-flex h-10 items-center gap-2 rounded-[6px] bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[14px] font-semibold text-white transition-colors hover:bg-[#34352F] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 3v9" />
            <path d="m6.5 8.5 3.5 3.5 3.5-3.5" />
            <path d="M4 14.5v1a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5v-1" />
          </svg>
          Export PDF
        </button>
      </div>
    </header>
      {exportNotice ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
        >
          <div className="pointer-events-auto inline-flex max-w-[92vw] items-center gap-2.5 rounded-full border border-[#2C2E28] bg-[#1B1C18] px-4 py-2.5 font-['Space_Grotesk'] text-[14px] font-medium text-white shadow-[0_12px_32px_rgba(27,28,24,0.24)] transition-all duration-200">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#4ADE80]" aria-hidden="true" />
            <span>{exportNotice}</span>
          </div>
        </div>
      ) : null}
    {error ? <div className="rounded-[8px] border border-[#E9D4D0] bg-[#FFF8F6] p-4 text-[14px] text-[#984B3E]">Analytics could not be loaded. {error}</div> : null}
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Total calls" value={total.toLocaleString("en-IN")} note={`${number(data?.pipeline, "pendingInQueue")} waiting in queue`} />
      <Metric label="Connection rate" value={percent(connected, total)} note={`${connected.toLocaleString("en-IN")} connected calls`} />
      <Metric label="Average connected call" value={duration(number(metrics, "avgDurationSeconds"))} note={`${duration(number(metrics, "totalDurationSeconds"))} total talk time`} />
      <Metric label="Credits consumed" value={number(metrics, "totalCreditsCharged").toLocaleString("en-IN")} note={`${number(data?.quota, "creditsRemaining").toLocaleString("en-IN")} credits remaining`} />
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
      <div className={panel}><div className="flex items-start justify-between gap-3"><div><h2 className="font-['Space_Grotesk'] text-[15px] font-semibold text-[#252620]">Call activity</h2><p className="mt-1 text-[12px] text-[#92938C]">Daily calls and connected calls</p></div><span className="rounded-full bg-[#F3F0FA] px-2.5 py-1 text-[11px] font-semibold text-[#7655C7]">{timeframe === "all" ? "ALL TIME" : timeframe.toUpperCase()}</span></div><div className="mt-4"><TrendChart rows={trendRows} /></div><div className="mt-3 flex flex-wrap gap-4 text-[12px] text-[#777970]"><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-sm bg-[#EAE5F7]" /> Total calls</span><span className="flex items-center gap-2"><i className="h-2 w-2 rounded-sm bg-[#7655C7]" /> Connected</span></div></div>
      <div className={panel}><h2 className="font-['Space_Grotesk'] text-[15px] font-semibold text-[#252620]">Call outcomes</h2><p className="mt-1 text-[12px] text-[#92938C]">How calls ended during this period</p><div className="mt-6 space-y-5"><BreakdownRow label="Connected" value={connected} total={total} color="bg-[#4D9469]"/><BreakdownRow label="Unanswered or busy" value={unanswered} total={total} color="bg-[#D7A64A]"/><BreakdownRow label="Failed" value={failed} total={total} color="bg-[#C66C5C]"/><BreakdownRow label="Dropped early" value={number(metrics, "droppedEarlyCalls")} total={total} color="bg-[#8B8D88]"/></div><p className="mt-5 border-t border-[#F0EFE9] pt-3 text-[12px] text-[#92938C]">Outcome counts may not sum to total calls when calls have other outcomes.</p></div>
    </section>

    <section className="grid gap-4 xl:grid-cols-2">
      <div className={panel}><h2 className="font-['Space_Grotesk'] text-[15px] font-semibold text-[#252620]">Lead intelligence</h2><p className="mt-1 text-[12px] text-[#92938C]">Interest and sentiment captured from conversations</p><div className="mt-5 grid gap-6 sm:grid-cols-2"><div className="space-y-4"><p className="text-[12px] font-semibold uppercase tracking-wider text-[#92938C]">Interest level</p><BreakdownRow label="High interest" value={number(leads, "highInterestCount")} total={interestTotal} color="bg-[#4D9469]"/><BreakdownRow label="Medium interest" value={number(leads, "mediumInterestCount")} total={interestTotal} color="bg-[#D7A64A]"/><BreakdownRow label="Low interest" value={number(leads, "lowInterestCount")} total={interestTotal} color="bg-[#8B8D88]"/></div><div className="space-y-4"><p className="text-[12px] font-semibold uppercase tracking-wider text-[#92938C]">Sentiment</p><BreakdownRow label="Positive" value={number(sentiments, "positive")} total={total} color="bg-[#4D9469]"/><BreakdownRow label="Neutral" value={number(sentiments, "neutral")} total={total} color="bg-[#9B9D96]"/><BreakdownRow label="Negative" value={number(sentiments, "negative")} total={total} color="bg-[#C66C5C]"/></div></div><div className="mt-5 rounded-[6px] bg-[#F8F7F2] px-4 py-3"><p className="text-[12px] text-[#777970]">Follow-up requests</p><p className="mt-1 font-['Newsreader'] text-[26px] text-[#1B1C18]">{number(leads, "followUpsRequestedCount").toLocaleString("en-IN")}</p></div></div>
      <div className={panel}>
        <h2 className="font-['Space_Grotesk'] text-[15px] font-semibold text-[#252620]">Credits & usage</h2>
        <p className="mt-1 text-[12px] text-[#92938C]">Workspace credit consumption breakdown</p>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <p className="text-[12px] text-[#92938C]">Total credits consumed</p>
            <p className="mt-1 font-['Newsreader'] text-[32px] leading-none text-[#1B1C18]">
              {number(metrics, "totalCreditsCharged").toLocaleString("en-IN")}
            </p>
          </div>
          <p className="text-right text-[12px] text-[#92938C]">
            {number(data?.quota, "creditsRemaining").toLocaleString("en-IN")} credits available
          </p>
        </div>
        <div className="mt-6 space-y-4">
          <BreakdownRow
            label="Connected calls usage"
            value={number(metrics, "connectedCalls")}
            total={total}
            color="bg-[#4D9469]"
          />
          <BreakdownRow
            label="Unanswered / no-answer attempts"
            value={unanswered}
            total={total}
            color="bg-[#D7A64A]"
          />
          <BreakdownRow
            label="Incomplete / failed attempts"
            value={failed}
            total={total}
            color="bg-[#C66C5C]"
          />
        </div>
        <div className="mt-5 rounded-[6px] bg-[#F8F7F2] p-3 text-[12px] leading-5 text-[#777970]">
          Calls consume workspace credits based on connected duration. Unused credits rollover according to your plan tier.
        </div>
      </div>
    </section>

    <section className={panel}><div className="flex items-center justify-between gap-3"><div><h2 className="font-['Space_Grotesk'] text-[15px] font-semibold text-[#252620]">Campaign performance</h2><p className="mt-1 text-[12px] text-[#92938C]">Top campaigns by call volume</p></div><span className="text-[12px] text-[#92938C]">{campaignRows.length} campaigns</span></div>{campaignRows.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead><tr className="border-b border-[#F0EFE9] text-[11px] uppercase tracking-wider text-[#92938C]"><th className="pb-3 font-medium">Campaign</th><th className="pb-3 font-medium">Status</th><th className="pb-3 text-right font-medium">Calls</th><th className="pb-3 text-right font-medium">Connected</th><th className="pb-3 text-right font-medium">Connection rate</th><th className="pb-3 text-right font-medium">High interest</th></tr></thead><tbody>{campaignRows.map((row, index) => { const count = number(row, "totalCalls"); const ok = number(row, "connectedCalls"); return <tr key={String(row.campaignId ?? index)} className="border-b border-[#F5F4EF] last:border-0"><td className="py-3 pr-4 text-[13px] font-semibold text-[#252620]">{String(row.campaignName ?? "Campaign")}</td><td className="py-3 text-[12px] capitalize text-[#777970]">{String(row.campaignStatus ?? "unknown")}</td><td className="py-3 text-right text-[13px] tabular-nums text-[#252620]">{count}</td><td className="py-3 text-right text-[13px] tabular-nums text-[#252620]">{ok}</td><td className="py-3 text-right text-[13px] tabular-nums text-[#252620]">{percent(ok, count)}</td><td className="py-3 text-right text-[13px] tabular-nums text-[#252620]">{number(row, "highInterestCalls")}</td></tr>; })}</tbody></table></div> : <div className="py-12 text-center text-[13px] text-[#92938C]">Campaign performance will appear after calls are associated with campaigns.</div>}</section>
  </main>;
}
