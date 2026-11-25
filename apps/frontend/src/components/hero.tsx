"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Hero_top_left } from "@/components/utils/hero_top_left";
import { Hero_top_right } from "@/components/utils/hero_top_right";
import { Hero_bottom_left } from "@/components/utils/hero_bottom_left";
import { Hero_bottom_right } from "@/components/utils/hero_bottom_right";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUser } from "@/lib/supabase/auth";
import { User } from "@supabase/supabase-js";

export const Hero = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [workEmail, setWorkEmail] = useState("");
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let mounted = true;

    const getInitialUser = async () => {
      try {
        const currentUser = await getCurrentUser(supabase);
        if (mounted) setUser(currentUser);
      } catch (error) {
        console.error("Failed to fetch user:", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    getInitialUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signUpHref = workEmail.trim()
    ? `/sign-up?email=${encodeURIComponent(workEmail.trim())}`
    : "/sign-up";

  return (
    <section
      id="demo"
      className="relative mx-auto w-full max-w-7xl overflow-hidden px-6 pb-20 pt-10 md:px-10 md:pb-28 md:pt-16 lg:px-12"
    >
      {/* Floating cards for desktop view */}
      <div className="pointer-events-none absolute left-2 top-16 hidden xl:block">
        <div className="pointer-events-auto">
          <Hero_top_left />
        </div>
      </div>

      <div className="pointer-events-none absolute right-6 top-12 hidden xl:block">
        <div className="pointer-events-auto">
          <Hero_top_right />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-12 left-8 hidden xl:block">
        <div className="pointer-events-auto">
          <Hero_bottom_left />
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-12 right-8 hidden xl:block">
        <div className="pointer-events-auto">
          <Hero_bottom_right />
        </div>
      </div>

      {/* Central hero content (Outbound-only calling operations) */}
      <div className="mx-auto flex max-w-210 flex-col items-center text-center">
        {/* Main headline */}
        <h1 className="tracking-tight">
          <span className="block font-['Newsreader'] text-[46px] font-normal leading-[1.08] tracking-[-1px] text-[#1B1C18] sm:text-[56px] md:text-[68px]">
            A complete system
          </span>
          <span className="block font-['Space_Grotesk'] text-[46px] font-medium leading-[1.08] tracking-[-1px] text-[#1B1C18] sm:text-[56px] md:text-[68px]">
            for outbound AI calling
          </span>
          <span className="block font-['Newsreader'] text-[46px] font-normal italic leading-[1.08] tracking-[-1px] text-[#1B1C18] sm:text-[56px] md:text-[68px]">
            with deterministic rigor.
          </span>
        </h1>

        {/* Subtitle (Outbound-only: our agents call your prospects) */}
        <p className="mt-6 max-w-[54ch] font-['Space_Grotesk'] text-[15px] font-normal leading-[24px] tracking-[0.1px] text-[#525552] md:text-[16px]">
          Foolioo calls your prospects automatically with parallel outbound dialing,
          strict guardrails, and structured CRM outcomes—at{" "}
          <span className="font-semibold text-[#1B1C18] tabular-nums">₹4.20/minute</span>.
        </p>

        {/* CTA Area (Dynamic based on Auth) */}
        <div className="mt-8 flex w-full max-w-[500px] flex-col items-center justify-center">
          {!isLoading && (
            <>
              {user ? (
                <Link
                  href="/dashboard"
                  className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[13px] font-medium text-white shadow-xs transition-colors duration-200 hover:bg-[#3A3B37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2"
                >
                  Go to Dashboard
                  <span aria-hidden="true">→</span>
                </Link>
              ) : (
                <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-2">
                  <input
                    type="email"
                    value={workEmail}
                    onChange={(e) => setWorkEmail(e.target.value)}
                    placeholder="Enter your work email"
                    aria-label="Work email"
                    className="h-11 flex-1 rounded-md border border-[#DCD8CC] bg-white px-4 font-['Space_Grotesk'] text-[13px] text-[#1B1C18] placeholder-[#5F6360] shadow-xs outline-none transition focus:border-[#1B1C18] focus-visible:ring-2 focus-visible:ring-[#FD7032]"
                  />
                  <Link
                    href={signUpHref}
                    className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[13px] font-medium text-white shadow-xs transition-colors duration-200 hover:bg-[#3A3B37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2"
                  >
                    Start free trial
                    <span aria-hidden="true">→</span>
                  </Link>
                  <Link
                    href="/live-demo"
                    className="flex h-11 shrink-0 items-center justify-center rounded-md border border-[#DCD8CC] bg-white px-4 font-['Space_Grotesk'] text-[13px] font-medium text-[#1B1C18] shadow-xs transition-colors duration-200 hover:bg-[#F5F3EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2"
                  >
                    Trial call
                  </Link>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sub-text guarantee (Hide if logged in) */}
        {!isLoading && !user && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-['Space_Grotesk'] text-[12px] font-normal text-[#525552]">
            <span>7-day free trial</span>
            <span aria-hidden="true">•</span>
            <span>No credit card required</span>
            <span aria-hidden="true">•</span>
            <span>Cancel anytime</span>
          </div>
        )}
      </div>
    </section>
  );
};

/* ============================================================================
 * UPCOMING OUTBOUND VOICE SAMPLE HERO (COMMENTED UNTIL RECORDINGS ARE IN /public)
 *
 * How to activate once you add audio files:
 *   1. Drop your recordings into apps/frontend/public/samples/:
 *      - /samples/outbound-renewal.mp3
 *      - /samples/outbound-followup.mp3
 *   2. Remove the active `Hero` component above (and unused `Hero_*` imports).
 *   3. Uncomment this block (remember to also import `useRef` from "react").
 * ============================================================================

type OutboundCallSample = {
  id: "renewal" | "followup";
  tabLabel: string;
  agentTitle: string;
  callerLabel: string;
  company: string;
  audioSrc: string;
  durationSec: number;
  latencyMs: number;
  outcomeBadge: string;
  transcript: {
    speaker: "AI Agent" | "Prospect";
    line: string;
  }[];
};

const OUTBOUND_CALL_SAMPLES: OutboundCallSample[] = [
  {
    id: "renewal",
    tabLabel: "Outbound Renewal",
    agentTitle: "Outbound Agent #04 · Renewal Desk",
    callerLabel: "Arjun Kapoor · +91 98201 45019",
    company: "Acme Logistics",
    audioSrc: "/samples/outbound-renewal.mp3",
    durationSec: 18,
    latencyMs: 240,
    outcomeBadge: "Meeting Booked · Tue 11:30 AM",
    transcript: [
      {
        speaker: "AI Agent",
        line: "Hi Arjun, calling from Foolioo Ops—your annual fleet plan renews next Friday. Would you like to lock in the current ₹4.20/min tier?",
      },
      {
        speaker: "Prospect",
        line: "Yes, actually—can we add two regional dispatch numbers before renewal?",
      },
      {
        speaker: "AI Agent",
        line: "Confirmed. I have noted two +91 numbers and booked a 10-minute setup review for Tuesday at 11:30 AM.",
      },
    ],
  },
  {
    id: "followup",
    tabLabel: "Lead Follow-up",
    agentTitle: "Outbound Agent #02 · Campaign Follow-up",
    callerLabel: "Priya Sharma · +91 98450 61237",
    company: "Guild Real Estate",
    audioSrc: "/samples/outbound-followup.mp3",
    durationSec: 21,
    latencyMs: 225,
    outcomeBadge: "Qualified Lead · Synced to CRM",
    transcript: [
      {
        speaker: "AI Agent",
        line: "Hi Priya, calling from Guild Realty regarding the Bandra West property enquiry you submitted. Do you have 60 seconds?",
      },
      {
        speaker: "Prospect",
        line: "Sure—we are looking for a 3BHK under ₹1.2L/month and hoping to move within 45 days.",
      },
      {
        speaker: "AI Agent",
        line: "Thank you, Priya. Two matching listings are available for site visits this Thursday—sending details to your WhatsApp now.",
      },
    ],
  },
];

const WAVEFORM_HEIGHTS = [32, 68, 48, 88, 60, 96, 44, 78, 54, 92, 38, 74, 84, 50, 66, 90, 42, 72];

export const HeroWithVoiceSample = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [workEmail, setWorkEmail] = useState("");
  const [activeSampleId, setActiveSampleId] = useState<"renewal" | "followup">("renewal");
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [durationSec, setDurationSec] = useState(18);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const activeSample =
    OUTBOUND_CALL_SAMPLES.find((sample) => sample.id === activeSampleId) ?? OUTBOUND_CALL_SAMPLES[0];

  useEffect(() => {
    let mounted = true;

    const getInitialUser = async () => {
      try {
        const currentUser = await getCurrentUser(supabase);
        if (mounted) setUser(currentUser);
      } catch (error) {
        console.error("Failed to fetch user:", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    getInitialUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    setDurationSec(activeSample.durationSec);
    setElapsedSec(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, [activeSample]);

  const handleSampleSwitch = (id: "renewal" | "followup") => {
    setActiveSampleId(id);
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("Audio playback failed:", err);
        setIsPlaying(false);
      }
    }
  };

  const signUpHref = workEmail.trim()
    ? `/sign-up?email=${encodeURIComponent(workEmail.trim())}`
    : "/sign-up";

  const formatTimer = (sec: number) => {
    const whole = Math.floor(sec);
    return `00:${String(whole).padStart(2, "0")}`;
  };

  const safeDuration = durationSec > 0 ? durationSec : activeSample.durationSec;
  const activeTurnIndex = Math.min(
    activeSample.transcript.length - 1,
    Math.floor((elapsedSec / safeDuration) * activeSample.transcript.length)
  );

  return (
    <section
      id="demo"
      className="relative mx-auto w-full max-w-[1280px] overflow-hidden px-6 pb-20 pt-10 md:px-10 md:pb-28 md:pt-16"
    >
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-12">
        <div className="flex flex-col items-start text-left lg:col-span-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E3DFD3] bg-white px-3 py-1 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-[#22A06B]" />
            <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.1px] text-[#4A4843]">
              Outbound AI Calling · SOC-2 Type II Certified
            </span>
          </div>

          <h1 className="mt-6 tracking-tight">
            <span className="block font-['Newsreader'] text-[44px] font-normal leading-[1.06] tracking-[-1px] text-[#1B1C18] sm:text-[54px] xl:text-[62px]">
              Outbound AI calling that
            </span>
            <span className="block font-['Space_Grotesk'] text-[44px] font-medium leading-[1.06] tracking-[-1px] text-[#1B1C18] sm:text-[54px] xl:text-[62px]">
              follows your rules
            </span>
            <span className="block font-['Newsreader'] text-[44px] font-normal italic leading-[1.06] tracking-[-1px] text-[#1B1C18] sm:text-[54px] xl:text-[62px]">
              and books on autopilot.
            </span>
          </h1>

          <p className="mt-6 max-w-[54ch] font-['Space_Grotesk'] text-[15px] font-normal leading-[25px] tracking-[0.1px] text-[#525552] md:text-[16px]">
            Foolioo dials your prospects automatically with natural voice latency, strict script guardrails, and instant CRM updates—at{" "}
            <span className="font-semibold text-[#1B1C18] tabular-nums">₹4.20/minute</span>{" "}
            (~77% less than an outsourced call center).
          </p>

          <div className="mt-8 flex w-full max-w-[520px] flex-col">
            {!isLoading && (
              <>
                {user ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href="/dashboard"
                      className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-[#1B1C18] px-6 font-['Space_Grotesk'] text-[13px] font-semibold text-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#34352F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF9F2]"
                    >
                      <span>Go to Dashboard</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                    <Link
                      href="/live-demo"
                      className="inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-[#E3DFD3] bg-white px-5 font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] shadow-2xs transition-colors duration-200 hover:bg-[#F5F3EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF9F2]"
                    >
                      Do a Trial Call
                    </Link>
                  </div>
                ) : (
                  <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-2">
                    <input
                      type="email"
                      value={workEmail}
                      onChange={(e) => setWorkEmail(e.target.value)}
                      placeholder="Enter your work email"
                      aria-label="Work email"
                      className="h-11 flex-1 rounded-md border border-[#DCD8CC] bg-white px-4 font-['Space_Grotesk'] text-[13px] text-[#1B1C18] placeholder-[#5F6360] shadow-2xs outline-none transition focus:border-[#1B1C18] focus-visible:ring-2 focus-visible:ring-[#FD7032]"
                    />
                    <Link
                      href={signUpHref}
                      className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#1B1C18] px-5 font-['Space_Grotesk'] text-[13px] font-semibold text-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#34352F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF9F2]"
                    >
                      <span>Start free trial</span>
                      <span aria-hidden="true">→</span>
                    </Link>
                    <Link
                      href="/live-demo"
                      className="flex h-11 shrink-0 items-center justify-center rounded-md border border-[#DCD8CC] bg-white px-4 font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] shadow-2xs transition-colors duration-200 hover:bg-[#F5F3EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FBF9F2]"
                    >
                      Trial call
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-3.5 gap-y-1 font-['Space_Grotesk'] text-[12px] font-normal text-[#525552]">
            {!isLoading && !user && (
              <>
                <span>7-day free trial</span>
                <span aria-hidden="true">•</span>
                <span>No credit card required</span>
                <span aria-hidden="true">•</span>
              </>
            )}
            <span>99.95% Uptime</span>
            <span aria-hidden="true">•</span>
            <span>TRAI &amp; DPDP ready</span>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="overflow-hidden rounded-2xl border border-[#E3DFD3] bg-white shadow-[0_14px_40px_rgba(27,28,24,0.07)]">
            <audio
              ref={audioRef}
              preload="metadata"
              src={activeSample.audioSrc}
              onLoadedMetadata={(e) => {
                const dur = e.currentTarget.duration;
                if (Number.isFinite(dur) && dur > 0) setDurationSec(dur);
              }}
              onTimeUpdate={(e) => setElapsedSec(e.currentTarget.currentTime)}
              onEnded={() => {
                setIsPlaying(false);
                setElapsedSec(0);
              }}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9E8E1] bg-[#FAFAF8] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22A06B] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22A06B]" />
                </span>
                <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[0.8px] text-[#1B1C18]">
                  Live Call Sample
                </span>
              </div>

              <div
                role="tablist"
                aria-label="Outbound call sample scenarios"
                className="inline-flex rounded-lg border border-[#E3DFD3] bg-[#F5F3EC] p-0.5"
              >
                {OUTBOUND_CALL_SAMPLES.map((sample) => {
                  const selected = sample.id === activeSample.id;
                  return (
                    <button
                      key={sample.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => handleSampleSwitch(sample.id)}
                      className={`rounded-md px-2.5 py-1 font-['Space_Grotesk'] text-[11px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] ${
                        selected
                          ? "bg-white text-[#1B1C18] shadow-2xs"
                          : "text-[#525552] hover:text-[#1B1C18]"
                      }`}
                    >
                      {sample.tabLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-b border-[#E9E8E1] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-['Space_Grotesk'] text-[13px] font-bold text-[#1B1C18]">
                    {activeSample.agentTitle}
                  </p>
                  <p className="mt-0.5 font-['Space_Grotesk'] text-[12px] text-[#525552] tabular-nums">
                    {activeSample.callerLabel} · {activeSample.company}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-[#F5F3EC] px-2 py-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#1B1C18] tabular-nums">
                    {activeSample.latencyMs}ms latency
                  </span>
                  <span className="rounded-md bg-[#E3FCEF] px-2 py-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#166534]">
                    Guardrails Active
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3.5 rounded-xl border border-[#EAE6DC] bg-[#FBF9F2] px-4 py-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={
                    isPlaying
                      ? `Pause ${activeSample.tabLabel} sample`
                      : `Play ${activeSample.tabLabel} sample`
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1B1C18] text-white shadow-xs transition-colors hover:bg-[#FD7032] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] focus-visible:ring-offset-2"
                >
                  {isPlaying ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  ) : (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                      className="ml-0.5"
                    >
                      <polygon points="6 4 20 12 6 20 6 4" />
                    </svg>
                  )}
                </button>

                <div
                  className="flex h-8 flex-1 items-center justify-between gap-1"
                  aria-hidden="true"
                >
                  {WAVEFORM_HEIGHTS.map((height, idx) => {
                    const progressRatio = elapsedSec / safeDuration;
                    const barRatio = idx / WAVEFORM_HEIGHTS.length;
                    const isPlayed = isPlaying && barRatio <= progressRatio;
                    return (
                      <span
                        key={idx}
                        style={{ height: `${height}%` }}
                        className={`w-1 rounded-full transition-all duration-300 ${
                          isPlayed
                            ? "bg-[#FD7032]"
                            : isPlaying
                              ? "animate-pulse bg-[#1B1C18]/75"
                              : "bg-[#1B1C18]/25"
                        }`}
                      />
                    );
                  })}
                </div>

                <span className="shrink-0 font-['Space_Grotesk'] text-[11px] font-semibold text-[#525552] tabular-nums">
                  {formatTimer(elapsedSec)} / {formatTimer(safeDuration)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5 bg-white p-5">
              {activeSample.transcript.map((turn, index) => {
                const isHighlighted = isPlaying && index === activeTurnIndex;
                return (
                  <div
                    key={index}
                    className={`rounded-lg border px-3.5 py-2.5 transition-colors ${
                      isHighlighted
                        ? "border-[#FD7032]/40 bg-[#FFF8F4]"
                        : "border-[#F0EDE5] bg-[#FCFBF8]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.8px] ${
                          turn.speaker === "AI Agent" ? "text-[#FD7032]" : "text-[#525552]"
                        }`}
                      >
                        {turn.speaker}
                      </span>
                      {index === activeSample.transcript.length - 1 && (
                        <span className="rounded bg-[#E3FCEF] px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold text-[#166534]">
                          {activeSample.outcomeBadge}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 font-['Space_Grotesk'] text-[12.5px] leading-[18px] text-[#1B1C18]">
                      {turn.line}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E9E8E1] bg-[#FAFAF8] px-5 py-3">
              <div className="flex items-center gap-3 font-['Space_Grotesk'] text-[11px] font-medium text-[#525552] tabular-nums">
                <span>Effective rate: ₹4.20/min</span>
                <span aria-hidden="true">•</span>
                <span>14,200+ production calls</span>
              </div>
              <Link
                href="/live-demo"
                className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18] transition-colors hover:text-[#FD7032] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032]"
              >
                Test with your own script →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
============================================================================ */
