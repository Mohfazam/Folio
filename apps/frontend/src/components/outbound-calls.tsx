"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type QueueStep = {
  rohanStatus: "Dialing..." | "Ringing (14s)" | "Connected" | "Meeting Booked";
  rohanDetail: string;
  dialedCount: number;
  connectedCount: number;
};

const QUEUE_STEPS: QueueStep[] = [
  {
    rohanStatus: "Dialing...",
    rohanDetail: "Apex Healthcare • Line 2 connecting",
    dialedCount: 142,
    connectedCount: 89,
  },
  {
    rohanStatus: "Ringing (14s)",
    rohanDetail: "Apex Healthcare • Local +91 caller ID",
    dialedCount: 143,
    connectedCount: 89,
  },
  {
    rohanStatus: "Connected",
    rohanDetail: "Apex Healthcare • Duration: 00:48",
    dialedCount: 143,
    connectedCount: 90,
  },
  {
    rohanStatus: "Meeting Booked",
    rohanDetail: "Apex Healthcare • Demo booked for Thu 3:00 PM",
    dialedCount: 143,
    connectedCount: 90,
  },
];

export const OutboundCalls = ({ isLoggedIn = false }: { isLoggedIn?: boolean }) => {
  const [stepIndex, setStepIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const timer = window.setInterval(() => {
      setStepIndex((prev) => (prev + 1) % QUEUE_STEPS.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [isPaused]);

  const currentStep = QUEUE_STEPS[stepIndex];
  const dialedPct = Math.round((currentStep.dialedCount / 200) * 100);
  const connectedPct = ((currentStep.connectedCount / currentStep.dialedCount) * 100).toFixed(1);

  return (
    <section className="w-full border-t border-[#E9E8E1] bg-[#FBF9F2] py-20 md:py-28">
      <div className="mx-auto w-full max-w-[1240px] px-6 md:px-10">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left text column */}
          <div className="flex flex-col lg:col-span-5">
            <div className="inline-flex items-center gap-2">
              <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.5px] text-[#525552]">
                OUTBOUND CAMPAIGNS
              </span>
            </div>

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
              Upload a contact list and set your rules. Foolioo dials prospects automatically with natural, context-aware conversations—handling objections, answering questions, and booking meetings onto your calendar.
            </p>

            {/* Feature bullets */}
            <div className="mt-8 flex flex-col gap-4">
              {[
                "Parallel dialing across calling windows with automated local presence caller ID.",
                "Sub-second voice response and natural interruption recovery that sounds genuinely human.",
                "Automatic call outcomes, recordings, and instant CRM sync after every conversation.",
              ].map((bullet, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1B1C18] text-[9px] text-white">
                    ✓
                  </div>
                  <p className="font-['Space_Grotesk'] text-[13.5px] font-medium leading-[21px] text-[#2D2F2B]">
                    {bullet}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <Link
                href={isLoggedIn ? "/dashboard/campaigns" : "/live-demo"}
                className="group inline-flex items-center gap-2 rounded-sm font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] transition-colors hover:text-[#FD7032] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-4 focus-visible:ring-offset-[#FBF9F2]"
              >
                <span>{isLoggedIn ? "Open Campaigns workspace" : "Try an outbound demo call"}</span>
                <span
                  aria-hidden="true"
                  className="inline-block transition-transform duration-200 group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </div>
          </div>

          {/* Right column: Live Outbound Dialer Campaign UI */}
          <div className="overflow-hidden rounded-2xl border border-[#E3DFD3] bg-white shadow-[0_10px_32px_rgba(27,28,24,0.06)] lg:col-span-7">
            {/* Dialer Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9E8E1] bg-[#FAFAF8] p-5">
              <div>
                <p className="font-['Space_Grotesk'] text-[13px] font-bold text-[#1B1C18]">
                  Active Campaign • Q4 Renewal Outreach
                </p>
                <p className="mt-0.5 font-['Space_Grotesk'] text-[11px] text-[#525552]">
                  Strategy: Tier 1 Priority • 4 lines concurrent
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaused((prev) => !prev)}
                  aria-pressed={isPaused}
                  className="rounded-md border border-[#E3DFD3] bg-white px-2.5 py-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#4A4843] transition-colors hover:bg-[#F5F3EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032]"
                >
                  {isPaused ? "Resume preview" : "Pause preview"}
                </button>
                <span className="flex items-center gap-1.5 rounded-full bg-[#E3FCEF] px-2.5 py-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#166534]">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-[#22A06B]" />
                  Live • 4 Lines Active
                </span>
              </div>
            </div>

            {/* Progress Stats Bar */}
            <div className="border-b border-[#E9E8E1] bg-[#FCFBF8] p-5">
              <div className="flex items-center justify-between font-['Space_Grotesk'] text-[11.5px] font-medium text-[#525552] tabular-nums">
                <span>
                  {currentStep.dialedCount} of 200 Dialed ({dialedPct}%)
                </span>
                <span className="font-semibold text-[#1B1C18]">
                  {currentStep.connectedCount} Connected ({connectedPct}%)
                </span>
              </div>
              <div className="mt-2.5 flex h-2 w-full overflow-hidden rounded-full bg-[#E9E8E1]">
                <div
                  className="h-full bg-[#1B1C18] transition-all duration-500"
                  style={{ width: `${dialedPct}%` }}
                />
                <div className="h-full w-[16%] bg-[#FD7032] transition-all duration-500" />
                <div className="h-full w-[9%] bg-[#22A06B]" />
              </div>
            </div>

            {/* Calls Table / List */}
            <div className="divide-y divide-[#E9E8E1]">
              {/* Row 1 */}
              <div className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-[#FAFAF8]">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E9E8E1] font-['Space_Grotesk'] text-[11px] font-bold text-[#1B1C18]">
                    AK
                  </div>
                  <div>
                    <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] tabular-nums">
                      Arjun Kapoor • +91 98201 45019
                    </p>
                    <p className="font-['Space_Grotesk'] text-[11.5px] text-[#525552] tabular-nums">
                      Acme Logistics • Duration: 02:14
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden items-center gap-0.5 sm:flex" aria-hidden="true">
                    <span className="h-2 w-0.5 animate-pulse bg-[#22A06B]" />
                    <span className="h-4 w-0.5 animate-pulse bg-[#22A06B] delay-75" />
                    <span className="h-3 w-0.5 animate-pulse bg-[#22A06B] delay-150" />
                    <span className="h-5 w-0.5 animate-pulse bg-[#22A06B]" />
                    <span className="h-2 w-0.5 animate-pulse bg-[#22A06B] delay-100" />
                  </div>
                  <span className="rounded bg-[#E3FCEF] px-2.5 py-0.5 font-['Space_Grotesk'] text-[11px] font-semibold text-[#166534]">
                    Connected
                  </span>
                </div>
              </div>

              {/* Row 2 (Live progressing call) */}
              <div className="flex items-center justify-between gap-3 bg-[#FFFDF9] p-4 transition-colors hover:bg-[#FAFAF8]">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B1C18] font-['Space_Grotesk'] text-[11px] font-bold text-white">
                    RM
                  </div>
                  <div>
                    <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] tabular-nums">
                      Rohan Mehta • +91 99300 27184
                    </p>
                    <p className="font-['Space_Grotesk'] text-[11.5px] text-[#525552]">
                      {currentStep.rohanDetail}
                    </p>
                  </div>
                </div>

                <span
                  className={`shrink-0 rounded px-2.5 py-0.5 font-['Space_Grotesk'] text-[11px] font-semibold transition-colors ${
                    currentStep.rohanStatus === "Meeting Booked" ||
                    currentStep.rohanStatus === "Connected"
                      ? "bg-[#E3FCEF] text-[#166534]"
                      : "bg-[#FFF0E8] text-[#B5410E]"
                  }`}
                >
                  {currentStep.rohanStatus}
                </span>
              </div>

              {/* Row 3 */}
              <div className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-[#FAFAF8]">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E9E8E1] font-['Space_Grotesk'] text-[11px] font-bold text-[#1B1C18]">
                    PS
                  </div>
                  <div>
                    <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] tabular-nums">
                      Priya Sharma • +91 98450 61237
                    </p>
                    <p className="font-['Space_Grotesk'] text-[11.5px] text-[#525552]">
                      Summit Media • Call completed
                    </p>
                  </div>
                </div>

                <span className="rounded bg-[#E3FCEF] px-2.5 py-0.5 font-['Space_Grotesk'] text-[11px] font-semibold text-[#166534]">
                  Meeting Booked
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
