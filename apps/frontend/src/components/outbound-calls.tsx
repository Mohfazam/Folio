"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type CampaignPresetId = "renewal" | "winback";

type CallRow = {
  initials: string;
  name: string;
  phone: string;
  company: string;
  statusLabel: string;
  statusTone: "success" | "accent" | "neutral";
  detail: string;
  isLive?: boolean;
};

type CampaignPreset = {
  id: CampaignPresetId;
  tabLabel: string;
  title: string;
  meta: string;
  dialed: number;
  total: number;
  connected: number;
  rows: CallRow[];
  latestEvent: string;
};

const PRESETS: CampaignPreset[] = [
  {
    id: "renewal",
    tabLabel: "Renewal Outreach",
    title: "Active Campaign • Q4 Renewal Outreach",
    meta: "Tier 1 Priority • 4 lines concurrent • Local +91 caller ID",
    dialed: 142,
    total: 200,
    connected: 89,
    latestEvent: "CRM updated: Priya Sharma booked callback for Thu 3:00 PM",
    rows: [
      {
        initials: "AK",
        name: "Arjun Kapoor",
        phone: "+91 98201 45019",
        company: "Acme Logistics",
        statusLabel: "Connected · 02:14",
        statusTone: "success",
        detail: "Confirmed annual renewal & 2 dispatch lines",
        isLive: true,
      },
      {
        initials: "RM",
        name: "Rohan Mehta",
        phone: "+91 99300 27184",
        company: "Apex Healthcare",
        statusLabel: "Dialing...",
        statusTone: "accent",
        detail: "Line 2 active • Natural cadence enabled",
      },
      {
        initials: "PS",
        name: "Priya Sharma",
        phone: "+91 98450 61237",
        company: "Summit Media",
        statusLabel: "Meeting Booked",
        statusTone: "success",
        detail: "Calendar invite sent • Recording synced",
      },
    ],
  },
  {
    id: "winback",
    tabLabel: "Win-Back Queue",
    title: "Active Campaign • Churned Lead Reactivation",
    meta: "Tier 2 Follow-up • 4 lines concurrent • Automated retry rules",
    dialed: 318,
    total: 500,
    connected: 174,
    latestEvent: "Retry queued for 2 unanswered leads in 2 hours",
    rows: [
      {
        initials: "DK",
        name: "Devansh Kulkarni",
        phone: "+91 98111 33409",
        company: "Harbor Freight",
        statusLabel: "Connected · 01:52",
        statusTone: "success",
        detail: "Answered pricing objection • Requested quote",
        isLive: true,
      },
      {
        initials: "SN",
        name: "Sneha Nair",
        phone: "+91 98702 88210",
        company: "Kaveri Retail",
        statusLabel: "Ringing (9s)",
        statusTone: "accent",
        detail: "Line 4 active • TRAI consent verified",
      },
      {
        initials: "VK",
        name: "Vikramaditya Rao",
        phone: "+91 99001 54122",
        company: "Deccan MedTech",
        statusLabel: "Callback Set",
        statusTone: "neutral",
        detail: "Scheduled for tomorrow 10:30 AM",
      },
    ],
  },
];

export const OutboundCalls = ({ isLoggedIn = false }: { isLoggedIn?: boolean }) => {
  const [presetId, setPresetId] = useState<CampaignPresetId>("renewal");
  const [liveTick, setLiveTick] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setLiveTick((t) => (t + 1) % 3);
    }, 2400);
    return () => window.clearInterval(id);
  }, [paused]);

  const activePreset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  const currentDialed = Math.min(activePreset.total, activePreset.dialed + liveTick);
  const currentConnected = activePreset.connected + (liveTick === 2 ? 1 : 0);
  const pct = Math.round((currentDialed / activePreset.total) * 100);

  return (
    <section
      id="products"
      className="w-full border-t border-[#E9E8E1] bg-[#FBF9F2] py-20 md:py-28"
    >
      <div className="mx-auto w-full max-w-[1240px] px-6 md:px-10">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-14">
          {/* Left Column (7 cols): Interactive Outbound Dialer Card */}
          <div className="order-2 overflow-hidden rounded-2xl border border-[#E3DFD3] bg-white shadow-[0_12px_36px_rgba(27,28,24,0.06)] lg:order-1 lg:col-span-7">
            {/* Header + Campaign Switcher */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9E8E1] bg-[#FAFAF8] px-5 py-4">
              <div>
                <p className="font-['Space_Grotesk'] text-[13.5px] font-bold text-[#1B1C18]">
                  {activePreset.title}
                </p>
                <p className="mt-0.5 font-['Space_Grotesk'] text-[11px] text-[#525552]">
                  {activePreset.meta}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div
                  role="tablist"
                  aria-label="Campaign presets"
                  className="inline-flex rounded-lg border border-[#E3DFD3] bg-[#F5F3EC] p-0.5"
                >
                  {PRESETS.map((preset) => {
                    const active = preset.id === activePreset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => {
                          setPresetId(preset.id);
                          setLiveTick(0);
                        }}
                        className={`rounded-md px-2.5 py-1 font-['Space_Grotesk'] text-[11px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] ${
                          active
                            ? "bg-white text-[#1B1C18] shadow-2xs"
                            : "text-[#525552] hover:text-[#1B1C18]"
                        }`}
                      >
                        {preset.tabLabel}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  aria-pressed={paused}
                  className="rounded-md border border-[#E3DFD3] bg-white px-2.5 py-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#4A4843] transition hover:bg-[#F5F3EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032]"
                >
                  {paused ? "Resume" : "Pause"}
                </button>
              </div>
            </div>

            {/* Batch Progress Strip */}
            <div className="border-b border-[#E9E8E1] bg-[#FCFBF8] px-5 py-4">
              <div className="flex items-center justify-between font-['Space_Grotesk'] text-[11.5px] font-medium text-[#525552] tabular-nums">
                <span>
                  {currentDialed} of {activePreset.total} Dialed ({pct}%)
                </span>
                <span className="font-semibold text-[#1B1C18]">
                  {currentConnected} Connected
                </span>
              </div>
              <div className="mt-2.5 flex h-2 w-full overflow-hidden rounded-full bg-[#E9E8E1]">
                <div
                  className="h-full bg-[#1B1C18] transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
                <div className="h-full w-[14%] bg-[#FD7032] transition-all duration-500" />
                <div className="h-full w-[8%] bg-[#22A06B]" />
              </div>
            </div>

            {/* Contact Call Rows */}
            <div className="divide-y divide-[#E9E8E1]">
              {activePreset.rows.map((row) => (
                <div
                  key={row.phone}
                  className="flex items-center justify-between gap-3 px-5 py-4 transition-colors hover:bg-[#FAFAF8]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#E3DFD3] bg-[#F5F3EC] font-['Space_Grotesk'] text-[11px] font-bold text-[#1B1C18]">
                      {row.initials}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-['Space_Grotesk'] text-[13px] font-bold text-[#1B1C18] tabular-nums">
                        {row.name} • {row.phone}
                      </p>
                      <p className="truncate font-['Space_Grotesk'] text-[11.5px] text-[#525552]">
                        {row.company} • {row.detail}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2.5">
                    {row.isLive && (
                      <div className="hidden items-center gap-0.5 sm:flex" aria-hidden="true">
                        <span className="h-2 w-0.5 animate-pulse bg-[#22A06B]" />
                        <span className="h-4 w-0.5 animate-pulse bg-[#22A06B]" />
                        <span className="h-3 w-0.5 animate-pulse bg-[#22A06B]" />
                        <span className="h-5 w-0.5 animate-pulse bg-[#22A06B]" />
                      </div>
                    )}
                    <span
                      className={`rounded-md px-2.5 py-1 font-['Space_Grotesk'] text-[11px] font-semibold tabular-nums ${
                        row.statusTone === "success"
                          ? "bg-[#E3FCEF] text-[#166534]"
                          : row.statusTone === "accent"
                            ? "bg-[#FFF0E8] text-[#B5410E]"
                            : "bg-[#F5F3EC] text-[#2D2F2B]"
                      }`}
                    >
                      {row.statusLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Real-Time Sync Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E9E8E1] bg-[#FAFAF8] px-5 py-3">
              <div className="flex items-center gap-2 font-['Space_Grotesk'] text-[11.5px] text-[#525552]">
                <span className="h-2 w-2 shrink-0 rounded-full bg-[#22A06B]" />
                <span>{activePreset.latestEvent}</span>
              </div>
            </div>
          </div>

          {/* Right Column (5 cols): Business Value & Action */}
          <div className="order-1 flex flex-col lg:order-2 lg:col-span-5">
            <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.5px] text-[#525552]">
              OUTBOUND CAMPAIGNS
            </span>

            <h2 className="mt-4">
              <span className="block font-['Newsreader'] text-[36px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[44px]">
                Foolioo runs your outbound
              </span>
              <span className="block font-['Newsreader'] text-[36px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[44px]">
                calls{" "}
                <span className="italic">with human poise.</span>
              </span>
            </h2>

            <p className="mt-5 max-w-[54ch] font-['Space_Grotesk'] text-[15px] font-normal leading-[24px] tracking-[0.1px] text-[#525552]">
              Upload your lead list and set your call rules. Foolioo dials prospects automatically with natural conversation pacing—handling objections, answering questions, and booking meetings without manual follow-up.
            </p>

            <div className="mt-7 flex flex-col gap-3.5">
              {[
                "Parallel dialing across calling windows with local caller ID presence.",
                "Natural turn-taking and interruption recovery that sounds human.",
                "Automatic disposition logging, call recordings, and CRM updates.",
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1B1C18] text-[9px] text-white">
                    ✓
                  </span>
                  <p className="font-['Space_Grotesk'] text-[13.5px] font-medium leading-[20px] text-[#2D2F2B]">
                    {item}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Link
                href={isLoggedIn ? "/dashboard/campaigns" : "/live-demo"}
                className="group inline-flex items-center gap-2 rounded-lg bg-[#1B1C18] px-5 py-3 font-['Space_Grotesk'] text-[13px] font-semibold text-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#FD7032] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2"
              >
                <span>{isLoggedIn ? "Open Campaigns" : "Do a Trial Call"}</span>
                <span
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
