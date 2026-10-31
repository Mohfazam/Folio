
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="m5 10.2 3.1 3.1L15.2 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <rect x="4.1" y="8.5" width="11.8" height="8.2" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6.8 8.5V6.2a3.2 3.2 0 0 1 6.4 0v2.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M10 11.7v1.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M3.2 8h9.6M8.3 3.5 12.8 8l-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VoiceWaveform() {
  const heights = [
    9, 15, 11, 20, 14, 25, 12, 18, 27, 14, 21, 10,
    17, 24, 12, 19, 8, 15, 22, 11, 17, 9, 20, 13,
    25, 11, 18, 8, 14, 22, 12, 17, 9, 20, 13, 16,
  ];

  return (
    <div className="flex h-9 shrink-0 items-center gap-[3px]" aria-label="Illustrative voice waveform">
      {heights.map((height, index) => (
        <span
          key={index}
          className="auth-wave-bar w-[3px] rounded-full bg-[#8B75CE]"
          style={{
            height: `${height}px`,
            animationDelay: `${index * 35}ms`,
          }}
        />
      ))}
    </div>
  );
}

function SessionPreview() {
  const steps = [
    { number: "01", title: "Greeting", detail: "Approved opening", state: "done" },
    { number: "02", title: "Understand intent", detail: "Identify the request", state: "active" },
    { number: "03", title: "Qualify the lead", detail: "Ask permitted questions", state: "pending" },
    { number: "04", title: "Route the outcome", detail: "Complete or escalate", state: "pending" },
  ] as const;

  return (
    <div className="auth-float relative mx-auto w-full max-w-[610px]">
      <div className="overflow-hidden rounded-[20px] border border-[#E8E5DC] bg-[#FFFEFB] shadow-[0_24px_80px_rgba(38,34,24,0.10)]">

        {/* Window header */}
        <div className="flex h-12 items-center justify-between border-b border-[#EEECE5] bg-[#FCFBF7] px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#D8A49A]" />
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#E6C98D]" />
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#9AC7AF]" />
            <span className="ml-1 truncate font-['Space_Grotesk'] text-[10px] font-medium tracking-[0.08em] text-[#747878] sm:text-[11px]">
              FOOLIOO / VOICE OPERATIONS
            </span>
          </div>

          <span className="ml-2 shrink-0 rounded-full border border-[#E8E5DC] bg-white px-2.5 py-1 font-['Space_Grotesk'] text-[9px] font-medium tracking-[0.08em] text-[#747878] sm:text-[10px]">
            PRODUCT PREVIEW
          </span>
        </div>

        <div className="grid gap-0 md:grid-cols-[1.08fr_0.92fr]">

          {/* Conversation panel */}
          <div className="border-b border-[#EEECE5] p-4 sm:p-5 md:border-b-0 md:border-r">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-['Space_Grotesk'] text-[9px] font-semibold tracking-[0.12em] text-[#96968F]">
                  SAMPLE CONVERSATION
                </p>
                <h3 className="mt-1.5 font-['Newsreader'] text-[22px] leading-tight text-[#1B1C18]">
                  Lead qualification
                </h3>
              </div>

              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#EDF5EF] px-2.5 py-1.5 font-['Space_Grotesk'] text-[9px] font-medium text-[#397A55]">
                <span className="auth-status-pulse h-1.5 w-1.5 rounded-full bg-[#4F9A6B]" />
                DEMO
              </span>
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#EEECE5] bg-[#FCFBF8] p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAE5F5] font-['Newsreader'] text-[16px] text-[#604C99]">
                F
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#262720]">
                  Folio voice agent
                </p>
                <p className="mt-0.5 font-['Space_Grotesk'] text-[10px] text-[#898B84]">
                  Rule-guided conversation
                </p>
              </div>

              <VoiceWaveform />
            </div>

            <div className="mt-4 space-y-3">
              <div className="auth-message auth-message--one max-w-[92%] rounded-xl rounded-tl-sm border border-[#EEECE5] bg-[#F7F6F1] px-3.5 py-3">
                <p className="font-['Space_Grotesk'] text-[9px] font-semibold tracking-[0.08em] text-[#96968F]">
                  AI AGENT
                </p>
                <p className="mt-1 font-['Space_Grotesk'] text-[11px] leading-[18px] text-[#44473F]">
                  Thanks for your interest. What kind of solution are you looking for?
                </p>
              </div>

              <div className="auth-message auth-message--two ml-auto max-w-[88%] rounded-xl rounded-tr-sm border border-[#E7E0F3] bg-[#F4F0FA] px-3.5 py-3">
                <p className="font-['Space_Grotesk'] text-[9px] font-semibold tracking-[0.08em] text-[#806DB2]">
                  PROSPECT
                </p>
                <p className="mt-1 font-['Space_Grotesk'] text-[11px] leading-[18px] text-[#51496A]">
                  I want to understand the options and pricing first.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-[#EEECE5] pt-3">
              <span className="font-['Space_Grotesk'] text-[9px] text-[#92938C]">
                Transcript preview · Sample data
              </span>
              <span className="flex shrink-0 items-center gap-1 font-['Space_Grotesk'] text-[9px] font-medium text-[#7561A9]">
                View decision trace <ArrowIcon />
              </span>
            </div>
          </div>

          {/* Execution path */}
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="font-['Space_Grotesk'] text-[9px] font-semibold tracking-[0.12em] text-[#96968F]">
                EXECUTION PATH
              </p>
              <span className="font-['Space_Grotesk'] text-[9px] text-[#92938C]">
                01 / 04
              </span>
            </div>

            <div className="mt-5 space-y-0">
              {steps.map((step, index) => (
                <div
                  key={step.number}
                  className="relative grid grid-cols-[27px_minmax(0,1fr)_auto] items-start gap-x-3 pb-5 last:pb-0"
                >
                  {index !== steps.length - 1 && (
                    <span className="absolute left-[13px] top-[29px] h-[calc(100%-17px)] w-px bg-[#E8E5DC]" />
                  )}

                  <span
                    className={`relative z-[1] flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full border font-['Space_Grotesk'] text-[9px] font-semibold ${
                      step.state === "done"
                        ? "border-[#D7E8DA] bg-[#EDF5EF] text-[#397A55]"
                        : step.state === "active"
                          ? "border-[#D9D0EC] bg-[#F1ECF8] text-[#705AA8]"
                          : "border-[#EAE8E0] bg-white text-[#A2A39C]"
                    }`}
                  >
                    {step.state === "done" ? (
                      <CheckIcon className="h-3.5 w-3.5" />
                    ) : (
                      step.number
                    )}
                  </span>

                  <div className="min-w-0 pt-0.5">
                    <p
                      className={`font-['Space_Grotesk'] text-[11px] font-semibold ${
                        step.state === "pending" ? "text-[#92938C]" : "text-[#282A23]"
                      }`}
                    >
                      {step.title}
                    </p>
                    <p className="mt-0.5 font-['Space_Grotesk'] text-[10px] text-[#92938C]">
                      {step.detail}
                    </p>
                  </div>

                  {step.state === "active" && (
                    <span className="auth-active-pill mt-0.5 inline-flex h-5 min-h-5 shrink-0 self-start items-center justify-center whitespace-nowrap rounded-full bg-[#F1ECF8] px-2 font-['Space_Grotesk'] text-[8px] font-semibold leading-none uppercase tracking-[0.07em] text-[#705AA8]">
                      Active
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-[#EAE5F2] bg-[#F8F5FC] p-3.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-[#705AA8] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                  <LockIcon />
                </span>
                <p className="font-['Space_Grotesk'] text-[10px] font-semibold text-[#51496A]">
                  Guardrails stay in control
                </p>
              </div>
              <p className="mt-2 font-['Space_Grotesk'] text-[10px] leading-[16px] text-[#777087]">
                Responses follow approved rules. Unhandled requests can be routed to a person.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating status card */}
      <div className="absolute -bottom-5 -left-3 hidden items-center gap-2 rounded-xl border border-[#E8E5DC] bg-white/95 px-3.5 py-2.5 shadow-[0_12px_35px_rgba(38,34,24,0.09)] backdrop-blur sm:flex">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#EDF5EF] text-[#397A55]">
          <CheckIcon />
        </span>
        <div>
          <p className="font-['Space_Grotesk'] text-[10px] font-semibold text-[#34362E]">
            Controlled by design
          </p>
          <p className="font-['Space_Grotesk'] text-[9px] text-[#92938C]">
            Traceable decisions · Human handoff
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isSignUp =
    pathname?.includes("sign-up") || pathname?.includes("signup") || false;

  return (
    <main className="grid h-dvh grid-cols-1 overflow-hidden bg-[#FBF9F2] text-[#1B1C18] lg:grid-cols-2">

      {/* Authentication form */}
      <section className="relative flex h-dvh min-h-0 flex-col overflow-hidden bg-[#FCFBF7] px-6 py-5 sm:px-10 sm:py-6 lg:px-[clamp(3rem,7vw,7rem)] lg:py-8">
        <header className="relative z-20 flex h-14 shrink-0 items-center">
          <Link
            href="/"
            aria-label="Foolioo home"
            className="group inline-flex items-center gap-2.5 rounded-sm transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDAD86] focus-visible:ring-offset-4"
          >
            <Image
              src="/Foolioo.svg"
              alt=""
              aria-hidden="true"
              width={30}
              height={34}
              priority
              className="h-[34px] w-[30px] object-contain transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-[1.04]"
            />
            <span className="inline-flex items-baseline font-['Newsreader'] text-[32px] font-medium italic leading-none tracking-[-1.6px] text-[#24231F]">
              foolioo<span className="ml-[1px] not-italic text-[#FD7032]">.</span>
            </span>
          </Link>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex lg:items-center lg:justify-center lg:overflow-visible">
          <div className="w-full max-w-[400px] py-6 lg:py-8">
            {children}
          </div>
        </div>

      </section>

      {/* Shared product showcase. Same animated preview on both routes. */}
      <aside className="relative hidden h-dvh min-h-0 flex-col justify-center overflow-hidden border-l border-[#EAE7DE] bg-[#F8F6EF] px-8 py-7 lg:flex xl:px-14 xl:py-8">
        <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true">
          <div className="absolute -right-36 -top-36 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(133,105,190,0.10),transparent_68%)]" />
          <div className="absolute -bottom-52 -left-40 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(190,176,139,0.13),transparent_68%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(120,115,98,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(120,115,98,0.035)_1px,transparent_1px)] bg-[size:54px_54px] [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]" />
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <p className="font-['Space_Grotesk'] text-[10px] font-semibold tracking-[0.16em] text-[#777970]">
            THE FOOLIOO PLATFORM
          </p>
          <span className="flex items-center gap-2 rounded-full border border-[#E7E3D9] bg-white/65 px-3 py-1.5 font-['Space_Grotesk'] text-[9px] font-medium tracking-[0.08em] text-[#777970] backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8E79C5]" />
            {isSignUp ? "BUILT FOR YOUR WORKFLOW" : "YOUR WORKSPACE, CONNECTED"}
          </span>
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[690px]">
          <div className="mb-6 max-w-[560px]">
            <h2 className="font-['Newsreader'] text-[38px] font-normal leading-[1.04] tracking-[-1.1px] text-[#1B1C18] xl:text-[48px]">
              {isSignUp ? (
                <>Build conversations with <span className="italic text-[#7852D6]">clear intent.</span></>
              ) : (
                <>Your voice operations, <span className="italic text-[#7852D6]">under control.</span></>
              )}
            </h2>

            <p className="mt-4 max-w-[465px] font-['Space_Grotesk'] text-[12px] leading-[21px] text-[#777970] xl:text-[13px]">
              {isSignUp
                ? "Create a workspace for voice campaigns that follow your rules, capture useful context and know when a person should take over."
                : "Pick up where your team left off. Run structured conversations, inspect every decision and keep people in control of the moments that matter."}
            </p>
          </div>

          {/* This is deliberately outside the isSignUp condition. */}
          <SessionPreview />

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 font-['Space_Grotesk'] text-[9px] font-medium tracking-[0.09em] text-[#85877F]">
            <span className="flex items-center gap-2"><CheckIcon /> EXPLICIT RULES</span>
            <span className="hidden h-3 w-px bg-[#DDD9CE] sm:block" />
            <span className="flex items-center gap-2"><CheckIcon /> TRACEABLE DECISIONS</span>
            <span className="hidden h-3 w-px bg-[#DDD9CE] sm:block" />
            <span className="flex items-center gap-2"><CheckIcon /> HUMAN CONTROL</span>
          </div>

          <p className="mt-4 text-center font-['Space_Grotesk'] text-[9px] text-[#A09F96]">
            Illustrative product preview · Not live workspace data
          </p>
        </div>

      </aside>


      {/* Global animation styles. Child components are covered too. */}
      <style jsx global>{`
        .auth-float {
          animation: auth-float 7s cubic-bezier(0.42, 0, 0.24, 1) infinite;
          transform-origin: center;
          will-change: transform;
        }

        .auth-wave-bar {
          transform: scaleY(0.55);
          transform-origin: center;
          animation: auth-wave 1.25s ease-in-out infinite alternate;
          will-change: transform, opacity;
        }

        .auth-message {
          will-change: transform, opacity;
        }

        .auth-message--one {
          animation: auth-message-in 8s ease-in-out infinite;
        }

        .auth-message--two {
          animation: auth-message-in 8s ease-in-out 2.25s infinite;
        }

        .auth-active-pill {
          height: 20px;
          min-height: 20px;
          line-height: 1;
          flex-shrink: 0;
          align-self: flex-start;
          animation: auth-pill-pulse 2s ease-in-out infinite;
        }

        .auth-status-pulse {
          box-shadow: 0 0 0 0 rgba(79, 154, 107, 0.45);
          animation: auth-dot-pulse 1.8s ease-out infinite;
        }

        .auth-mini-orbit::before {
          content: "";
          position: absolute;
          inset: 5px;
          border: 1px solid rgba(120, 82, 214, 0.28);
          border-radius: 9999px;
          animation: auth-orbit 5s linear infinite;
        }

        .auth-mini-orbit::after {
          content: "";
          position: absolute;
          width: 5px;
          height: 5px;
          top: 2px;
          left: 50%;
          margin-left: -2.5px;
          border-radius: 9999px;
          background: #A995D7;
          transform-origin: 2.5px 15px;
          animation: auth-orbit 5s linear infinite;
        }

        @keyframes auth-float {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -8px, 0); }
        }

        @keyframes auth-wave {
          from { transform: scaleY(0.38); opacity: 0.52; }
          to { transform: scaleY(1); opacity: 1; }
        }

        @keyframes auth-message-in {
          0%, 5% { opacity: 0; transform: translateY(8px); }
          13%, 67% { opacity: 1; transform: translateY(0); }
          76%, 100% { opacity: 0; transform: translateY(-5px); }
        }

        @keyframes auth-pill-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(120, 82, 214, 0); }
          50% { box-shadow: 0 0 0 4px rgba(120, 82, 214, 0.08); }
        }

        @keyframes auth-dot-pulse {
          0% { box-shadow: 0 0 0 0 rgba(79, 154, 107, 0.4); }
          70%, 100% { box-shadow: 0 0 0 6px rgba(79, 154, 107, 0); }
        }

        @keyframes auth-orbit {
          to { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .auth-float,
          .auth-wave-bar,
          .auth-message,
          .auth-active-pill,
          .auth-status-pulse,
          .auth-mini-orbit::before,
          .auth-mini-orbit::after {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </main>
  );
}
