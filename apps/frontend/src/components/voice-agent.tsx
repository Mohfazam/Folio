"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthRedirectButton } from "@/components/ui/AuthRedirectButton";

const STEPS = [
  {
    id: 1,
    pill: "1. Consent Check",
    heading: "01. Identity & TRAI Consent Verification",
    badge: "Mandatory Step",
    body: "Confirm who answered and get their permission before sharing pricing or booking a visit.",
    simNote: "Passed: Contact gave permission to continue the call.",
  },
  {
    id: 2,
    pill: "2. Lead Qualification",
    heading: "02. Budget & Move-in Qualification",
    badge: "Budget ≥ ₹35,000/mo",
    body: "Capture monthly budget and move-in window (< 45 days). Qualified prospects receive an instant calendar invite.",
    simNote: "Passed: ₹48,000/mo budget & 25-day move-in verified.",
  },
  {
    id: 3,
    pill: "3. Hard Guardrail",
    heading: "Safety Rule Active",
    badge: "Zero Off-Script Claims",
    body: "Never offers security-deposit discounts or special lease terms without manager approval.",
    simNote: "Protected: Deposit discount request held for manager sign-off.",
  },
];

export const VoiceAgent = () => {
  const [activeStep, setActiveStep] = useState<number>(0);

  const runNextStep = () => {
    setActiveStep((prev) => (prev >= STEPS.length ? 1 : prev + 1));
  };

  return (
    <section className="w-full border-t border-[#E9E8E1] bg-[#FBF9F2] py-20 md:py-28">
      <div className="mx-auto w-full max-w-[1240px] px-6 md:px-10">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-14">
          {/* Right Column on Desktop: Interactive Flow & Guardrail Card */}
          <div className="order-2 overflow-hidden rounded-2xl border border-[#E3DFD3] bg-white shadow-[0_12px_36px_rgba(27,28,24,0.06)] lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9E8E1] bg-[#FAFAF8] px-5 py-4">
              <div>
                <p className="font-['Space_Grotesk'] text-[13.5px] font-bold text-[#1B1C18]">
                  Flow: Outbound Property Lead Qualification
                </p>
                <p className="mt-0.5 font-['Space_Grotesk'] text-[11px] text-[#525552]">
                  Rule-Guided Outbound Script • v2.4
                </p>
              </div>
              <span className="rounded-full bg-[#E3FCEF] px-3 py-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#166534]">
                Rules Locked
              </span>
            </div>

            {/* Plain-English Flow Pills Bar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-[#E9E8E1] bg-[#FCFBF8] px-5 py-3">
              {STEPS.map((s, index) => {
                const selected = activeStep === s.id;
                return (
                  <div key={s.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveStep(s.id)}
                      className={`rounded-full px-3 py-1 font-['Space_Grotesk'] text-[11px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] ${
                        selected
                          ? "bg-[#FD7032] text-white"
                          : "border border-[#E3DFD3] bg-white text-[#2D2F2B] hover:border-[#1B1C18]"
                      }`}
                    >
                      {s.pill}
                    </button>
                    {index < STEPS.length - 1 && (
                      <span aria-hidden="true" className="text-xs text-[#8C8F8E]">
                        →
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Rule Cards */}
            <div className="flex flex-col gap-3.5 p-5 sm:p-6">
              {STEPS.map((step) => {
                const isSelected = activeStep === step.id;
                const isGuardrail = step.id === 3;
                return (
                  <div
                    key={step.id}
                    className={`rounded-xl border p-4 transition-all ${
                      isSelected
                        ? "border-[#FD7032] bg-[#FFF8F4] shadow-xs"
                        : isGuardrail
                          ? "border-[#F59E0B]/45 bg-[#FEF3C7]/45"
                          : "border-[#E9E8E1] bg-[#FCFBF8]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`font-['Space_Grotesk'] text-[11.5px] font-bold ${
                          isGuardrail ? "text-[#78350F]" : "text-[#1B1C18]"
                        }`}
                      >
                        {isGuardrail ? `🛡️ ${step.heading}` : step.heading}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 font-['Space_Grotesk'] text-[10.5px] font-semibold tabular-nums ${
                          isGuardrail
                            ? "bg-[#FDE68A] text-[#78350F]"
                            : step.id === 2
                              ? "bg-[#E3FCEF] text-[#166534]"
                              : "bg-[#E9E8E1] text-[#2D2F2B]"
                        }`}
                      >
                        {step.badge}
                      </span>
                    </div>
                    <p
                      className={`mt-1.5 font-['Space_Grotesk'] text-[12.5px] leading-[19px] ${
                        isGuardrail ? "text-[#92400E]" : "text-[#525552]"
                      }`}
                    >
                      {step.body}
                    </p>
                    {isSelected && (
                      <p className="mt-2 rounded-md bg-white px-3 py-1.5 font-['Space_Grotesk'] text-[11.5px] font-semibold text-[#166534] ring-1 ring-[#166534]/20">
                        {step.simNote}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer with Simulate Agent */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E9E8E1] bg-[#FAFAF8] px-5 py-3.5">
              <span className="font-['Space_Grotesk'] text-[11.5px] font-medium text-[#525552] tabular-nums">
                12 test calls passed • 0 off-script answers
              </span>

              <div className="flex items-center gap-2.5">
                <Link
                  href="/live-demo"
                  className="font-['Space_Grotesk'] text-[11.5px] font-semibold text-[#525552] underline decoration-[#DCD8CC] underline-offset-4 hover:text-[#1B1C18]"
                >
                  Live test call
                </Link>
                <button
                  type="button"
                  onClick={runNextStep}
                  className="rounded-lg bg-[#1B1C18] px-3.5 py-1.5 font-['Space_Grotesk'] text-[11.5px] font-semibold text-white transition hover:bg-[#FD7032] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2"
                >
                  {activeStep === 0
                    ? "Simulate Agent"
                    : activeStep < STEPS.length
                      ? `Next Step (${activeStep}/${STEPS.length}) →`
                      : "Simulate Again"}
                </button>
              </div>
            </div>
          </div>

          {/* Left Column on Desktop: Copy & CTA (Alternating Z-pattern) */}
          <div className="order-1 flex flex-col lg:col-span-5">
            <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.5px] text-[#525552]">
              RULE-GUIDED AGENTS
            </span>

            <h2 className="mt-4">
              <span className="block font-['Newsreader'] text-[36px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[44px]">
                The voice agent that
              </span>
              <span className="block font-['Newsreader'] text-[36px] font-normal leading-[1.12] tracking-[-0.8px] text-[#1B1C18] sm:text-[44px]">
                follows your rules.{" "}
                <span className="italic">Every time.</span>
              </span>
            </h2>

            <p className="mt-5 max-w-[54ch] font-['Space_Grotesk'] text-[15px] font-normal leading-[24px] tracking-[0.1px] text-[#525552]">
              No made-up answers or off-script promises. Set clear steps and boundaries so every call follows your exact rules from hello to booking.
            </p>

            <div className="mt-7 flex flex-col gap-3.5">
              {[
                "Step-by-step rules keep every call aligned with your approved script.",
                "Built-in safety rules block unapproved discounts or false promises.",
                "Instant alerts notify your team when a hot lead wants a callback.",
              ].map((bullet, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#1B1C18] text-[9px] text-white">
                    ✓
                  </span>
                  <p className="font-['Space_Grotesk'] text-[13.5px] font-medium leading-[20px] text-[#2D2F2B]">
                    {bullet}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8">
              <AuthRedirectButton className="group inline-flex items-center gap-2 rounded-sm font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] transition-colors hover:text-[#FD7032] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-4 focus-visible:ring-offset-[#FBF9F2]">
                <span>Build an AI agent today</span>
                <span
                  aria-hidden="true"
                  className="transition-transform duration-200 group-hover:translate-x-1"
                >
                  →
                </span>
              </AuthRedirectButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
