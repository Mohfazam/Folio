"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthRedirectButton } from "@/components/ui/AuthRedirectButton";

const SIMULATION_STEPS = [
  {
    step: 1,
    label: "Step 1 of 3 · Consent & DND Check Passed",
    summary: "Verified TRAI DND status and confirmed prospect consent before presenting inventory.",
  },
  {
    step: 2,
    label: "Step 2 of 3 · Budget & Move-in Qualified",
    summary: "Confirmed ₹45,000/mo budget (≥ ₹35,000 threshold) and 30-day move-in timeline.",
  },
  {
    step: 3,
    label: "Step 3 of 3 · Site Visit Booked · 0 Policy Violations",
    summary: "Blocked off-script deposit discount request via guardrail and booked Saturday 11:00 AM.",
  },
];

export const VoiceAgent = () => {
  const [simStep, setSimStep] = useState<number>(0);

  const handleSimulateClick = () => {
    setSimStep((prev) => (prev >= SIMULATION_STEPS.length ? 1 : prev + 1));
  };

  const activeSim = simStep > 0 ? SIMULATION_STEPS[simStep - 1] : null;

  return (
    <section className="w-full border-t border-[#E9E8E1] bg-[#FBF9F2] py-20 md:py-28">
      <div className="mx-auto w-full max-w-[1240px] px-6 md:px-10">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-16">
          {/* Left Column: Interactive Rule Builder & Plain-English Flow Preview */}
          <div className="overflow-hidden rounded-2xl border border-[#E3DFD3] bg-white shadow-[0_10px_32px_rgba(27,28,24,0.06)] lg:col-span-7">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9E8E1] bg-[#FAFAF8] p-5">
              <div>
                <p className="font-['Space_Grotesk'] text-[13px] font-bold text-[#1B1C18]">
                  Agenda: Outbound Property Lead Follow-up
                </p>
                <p className="mt-0.5 font-['Space_Grotesk'] text-[11px] text-[#525552]">
                  Rule-Guided Call Flow • v2.4 (Active)
                </p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-[#E3FCEF] px-2.5 py-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#166534]">
                Strict Mode: Locked
              </span>
            </div>

            {/* Rules & Logic Tree */}
            <div className="flex flex-col gap-4 p-5 sm:p-6">
              {/* Node 1 */}
              <div
                className={`rounded-xl border p-4 transition-all ${
                  simStep === 1
                    ? "border-[#FD7032] bg-[#FFF9F5] shadow-xs"
                    : "border-[#E9E8E1] bg-[#FCFBF8]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-[0.5px] text-[#1B1C18]">
                    01. Identity &amp; TRAI Consent Verification
                  </span>
                  <span className="rounded bg-[#E9E8E1] px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold text-[#2D2F2B]">
                    Mandatory Step
                  </span>
                </div>
                <p className="mt-2 font-['Space_Grotesk'] text-[12.5px] leading-[19px] text-[#525552]">
                  Confirm prospect identity, state business purpose clearly, and verify affirmative consent before sharing property pricing.
                </p>
              </div>

              {/* Plain-English Branch Connector */}
              <div className="flex flex-wrap items-center gap-2 pl-4">
                <div className="h-5 w-0.5 bg-[#DCD8CC]" />
                <span className="rounded-md border border-[#E3DFD3] bg-[#F5F3EC] px-2.5 py-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#2D2F2B]">
                  Consent Verified → Qualify Budget · Declined → Polite Exit
                </span>
              </div>

              {/* Node 2 */}
              <div
                className={`rounded-xl border p-4 transition-all ${
                  simStep === 2
                    ? "border-[#FD7032] bg-[#FFF9F5] shadow-xs"
                    : "border-[#E9E8E1] bg-[#FCFBF8]"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-[0.5px] text-[#1B1C18]">
                    02. Budget &amp; Move-in Qualification
                  </span>
                  <span className="rounded bg-[#E3FCEF] px-2 py-0.5 font-['Space_Grotesk'] text-[10.5px] font-semibold text-[#166534] tabular-nums">
                    Condition: Budget ≥ ₹35,000/mo
                  </span>
                </div>
                <p className="mt-2 font-['Space_Grotesk'] text-[12.5px] leading-[19px] text-[#525552]">
                  Confirm monthly rental budget and move-in timeline (&lt; 45 days). When criteria match, send an instant calendar invite for a site visit.
                </p>
              </div>

              {/* Guardrail alert */}
              <div
                className={`flex items-start gap-2.5 rounded-xl border p-3.5 transition-all ${
                  simStep === 3
                    ? "border-[#D97706] bg-[#FEF3C7]/80 shadow-xs"
                    : "border-[#F59E0B]/40 bg-[#FEF3C7]/45"
                }`}
              >
                <span className="text-[14px]" aria-hidden="true">
                  🛡️
                </span>
                <div>
                  <p className="font-['Space_Grotesk'] text-[11.5px] font-bold text-[#78350F]">
                    Deterministic Guardrail Active
                  </p>
                  <p className="mt-0.5 font-['Space_Grotesk'] text-[11.5px] leading-[17px] text-[#92400E]">
                    Zero negotiation on security deposits or lease terms allowed without explicit manager approval.
                  </p>
                </div>
              </div>

              {/* Interactive Simulation Output Banner */}
              {activeSim && (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-xl border border-[#166534]/25 bg-[#E3FCEF]/60 px-4 py-3"
                >
                  <p className="font-['Space_Grotesk'] text-[11.5px] font-bold text-[#166534]">
                    {activeSim.label}
                  </p>
                  <p className="mt-0.5 font-['Space_Grotesk'] text-[12px] text-[#1B1C18]">
                    {activeSim.summary}
                  </p>
                </div>
              )}
            </div>

            {/* Bottom Action Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E9E8E1] bg-[#FAFAF8] px-5 py-3.5">
              <span className="font-['Space_Grotesk'] text-[11.5px] font-medium text-[#525552] tabular-nums">
                12 Test cases passed • 0 Hallucinations detected
              </span>

              <div className="flex items-center gap-2">
                {simStep > 0 && (
                  <button
                    type="button"
                    onClick={() => setSimStep(0)}
                    className="rounded-md px-2.5 py-1.5 font-['Space_Grotesk'] text-[11px] font-semibold text-[#525552] transition-colors hover:text-[#1B1C18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032]"
                  >
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSimulateClick}
                  className="rounded-md bg-[#1B1C18] px-3.5 py-1.5 font-['Space_Grotesk'] text-[11.5px] font-semibold text-white transition-colors hover:bg-[#FD7032] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2"
                >
                  {simStep === 0
                    ? "Simulate Rule Flow"
                    : simStep < SIMULATION_STEPS.length
                      ? `Next Step (${simStep}/${SIMULATION_STEPS.length}) →`
                      : "Replay Simulation"}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Text content */}
          <div className="flex flex-col lg:col-span-5">
            <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.5px] text-[#525552]">
              DETERMINISTIC AGENTS
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
              No hallucinations. No off-script promises. Build rule-guided outbound conversation flows that handle every objection exactly the way you approve—with fallback responses and hard guardrails baked in.
            </p>

            {/* Bullets */}
            <div className="mt-8 flex flex-col gap-4">
              {[
                "Step-by-step state guardrails guarantee 100% adherence to your approved script.",
                "Real-time compliance checks block off-topic claims or unauthorized discounts.",
                "Instant escalation alerts notify your team when a high-intent prospect requests a callback.",
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

            <div className="mt-8 flex flex-wrap items-center gap-5">
              <AuthRedirectButton className="group inline-flex items-center gap-2 rounded-sm font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] transition-colors hover:text-[#FD7032] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-4 focus-visible:ring-offset-[#FBF9F2]">
                <span>Build an AI agent today</span>
                <span
                  aria-hidden="true"
                  className="inline-block transition-transform duration-200 group-hover:translate-x-1"
                >
                  →
                </span>
              </AuthRedirectButton>

              <Link
                href="/live-demo"
                className="font-['Space_Grotesk'] text-[13px] font-medium text-[#525552] underline decoration-[#DCD8CC] underline-offset-4 transition-colors hover:text-[#1B1C18] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032]"
              >
                Or hear it call your phone
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
