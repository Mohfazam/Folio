"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUser } from "@/lib/supabase/auth";
import { User } from "@supabase/supabase-js";

const AUDIO_SRC = "/samples/hero-sample-call-hi.mp3";

type TranscriptTurn = {
  speaker: "agent" | "caller";
  text: string;
  telemetry: string;
};

const CALL_TRANSCRIPT: TranscriptTurn[] = [
  {
    speaker: "agent",
    text: "Hello! Bright Smile Dental mein aapka swagat hai. Main Priya bol rahi hoon. Bataiye main aapki kaise help kar sakti hoon?",
    telemetry: "tool: greet_caller · 0.2s",
  },
  {
    speaker: "caller",
    text: "Hello. Haan, mujhe apni Friday wali appointment reschedule karni hai sir.",
    telemetry: "intent: reschedule_booking · rtt 65ms",
  },
  {
    speaker: "agent",
    text: "Main abhi dekhti hoon. Kya aap apna booking ID ya naam bata sakte hain?",
    telemetry: "tool: lookup_prompt · 0.3s",
  },
  {
    speaker: "caller",
    text: "Haan. Note kijiye B-4-1. Rahul Sharma ke naam se hoga.",
    telemetry: "booking_ref: B41 · jitter 5ms",
  },
  {
    speaker: "agent",
    text: "Mil gaya, Rahul ji, ek minute... Aapki cleaning hai Dr. Patel ke saath, Friday 11 baje. Kab move karna chahenge?",
    telemetry: "tool: get_booking · 0.6s",
  },
  {
    speaker: "caller",
    text: "Agle hafte koi bhi time chalega. Mujhe Tuesday possible hai.",
    telemetry: "preferred_day: Tuesday · rtt 65ms",
  },
  {
    speaker: "agent",
    text: "Tuesday. Check karti hoon. Dr. Patel ke saath 3 PM ka slot available hai. Chalega?",
    telemetry: "tool: check_slots · 0.5s",
  },
  {
    speaker: "caller",
    text: "Haan, theek hai, chalega.",
    telemetry: "slot_confirmed: Tue 15:00 · jitter 5ms",
  },
  {
    speaker: "agent",
    text: "Tuesday 3 baje book kar diya aur confirmation aapke phone pe aa jayega. Aur kuch help chahiye?",
    telemetry: "tool: book_appointment · sms_queued",
  },
  {
    speaker: "caller",
    text: "Nahi aur kuch nahi. Thanks.",
    telemetry: "call_state: wrap_up · rtt 65ms",
  },
  {
    speaker: "agent",
    text: "Of course. Aapka din shubh ho, Rahul ji.",
    telemetry: "call_status: completed · 240ms",
  },
];

const UPPER_WAVE_BARS = [
  22, 48, 76, 92, 64, 38, 18, 54, 84, 96, 70, 42, 24, 62, 88, 52, 30, 74, 90, 58, 34, 66, 46, 20,
];

const LOWER_WAVE_BARS = [
  16, 34, 68, 86, 94, 58, 28, 44, 78, 88, 52, 26, 72, 92, 64, 36, 20, 56, 82, 48, 28, 60, 38, 18,
];

export const Hero = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [workEmail, setWorkEmail] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [durationSec, setDurationSec] = useState(54);

  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const safeDur = durationSec > 0 ? durationSec : 54;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const nextSec = ratio * safeDur;
    setElapsedSec(nextSec);
    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = nextSec;
    }
  };

  const signUpHref = workEmail.trim()
    ? `/sign-up?email=${encodeURIComponent(workEmail.trim())}`
    : "/sign-up";

  const formatTimer = (sec: number) => {
    const whole = Math.max(0, Math.floor(sec));
    const mins = Math.floor(whole / 60);
    const rem = whole % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  const safeDuration = durationSec > 0 ? durationSec : 54;
  const progressRatio = Math.min(1, Math.max(0, elapsedSec / safeDuration));
  const activeTurnIndex = Math.min(
    CALL_TRANSCRIPT.length - 1,
    Math.floor(progressRatio * CALL_TRANSCRIPT.length)
  );
  const activeTurn = CALL_TRANSCRIPT[activeTurnIndex];
  const sampleCounter = Math.round(progressRatio * 52000);

  return (
    <section
      id="demo"
      className="relative mx-auto w-full max-w-[1280px] overflow-hidden px-6 pb-20 pt-10 md:px-10 md:pb-28 md:pt-16"
    >
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-12">
        {/* Left Column: Headline, Subcopy, Auth CTA */}
        <div className="flex flex-col items-start text-left lg:col-span-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#E3DFD3] bg-white px-3 py-1 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-[#22A06B]" />
            <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[1.1px] text-[#4A4843]">
              Enterprise Communication Automation
            </span>
          </div>

          <h1 className="mt-6 tracking-tight">
            <span className="block font-['Newsreader'] text-[44px] font-normal leading-[1.06] tracking-[-1px] text-[#1B1C18] sm:text-[54px] xl:text-[62px]">
              Enterprise communication
            </span>
            <span className="block font-['Space_Grotesk'] text-[44px] font-medium leading-[1.06] tracking-[-1px] text-[#1B1C18] sm:text-[54px] xl:text-[62px]">
              automation across every
            </span>
            <span className="block font-['Newsreader'] text-[44px] font-normal italic leading-[1.06] tracking-[-1px] text-[#1B1C18] sm:text-[54px] xl:text-[62px]">
              channel and workflow.
            </span>
          </h1>

          <p className="mt-6 max-w-[54ch] font-['Space_Grotesk'] text-[15px] font-normal leading-[25px] tracking-[0.1px] text-[#525552] md:text-[16px]">
            Automate voice calls, WhatsApp, SMS, email, and tool workflows under your exact rules, starting at{" "}
            <span className="font-semibold text-[#1B1C18] tabular-nums">₹4.20/minute</span>{" "}
            (~77% less than an outsourced call center).
          </p>

          {/* CTA Area (Dynamic based on Auth) */}
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

        {/* Right Column: Call Scope Audio & Live Turn Inspector */}
        <div className="lg:col-span-6">
          <div className="overflow-hidden rounded-xl border border-[#23293A] bg-[#0D1017] text-[#E6EDF7] shadow-[0_20px_50px_rgba(13,16,23,0.22)]">
            <audio
              ref={audioRef}
              preload="metadata"
              src={AUDIO_SRC}
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

            {/* Top Inspector Header */}
            <div className="flex items-center justify-between border-b border-[#1E2536] bg-[#111520] px-4 py-2.5 font-mono text-[12px]">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#3B66F5]" />
                <span className="font-semibold tracking-tight text-[#F3F6FC]">
                  foolioo/call-scope
                </span>
              </div>
              <span className="text-[#8B95AC]">[recorded call]</span>
            </div>

            {/* Dual-Track Waveform + Playhead */}
            <div
              onClick={handleScrub}
              role="slider"
              tabIndex={0}
              aria-label="Seek call recording"
              aria-valuemin={0}
              aria-valuemax={Math.round(safeDuration)}
              aria-valuenow={Math.round(elapsedSec)}
              onKeyDown={(e) => {
                const audio = audioRef.current;
                if (!audio) return;
                if (e.key === "ArrowRight") {
                  audio.currentTime = Math.min(safeDuration, audio.currentTime + 3);
                } else if (e.key === "ArrowLeft") {
                  audio.currentTime = Math.max(0, audio.currentTime - 3);
                }
              }}
              className="relative cursor-pointer select-none border-b border-[#1E2536] bg-[#0B0E15] px-4 pb-6 pt-5"
            >
              {/* Playhead vertical cursor */}
              <div
                style={{ left: `calc(${progressRatio * 100}% + 16px - ${progressRatio * 32}px)` }}
                className="pointer-events-none absolute bottom-5 top-3 z-20 w-[1.5px] bg-[#3B66F5]"
              >
                <span className="absolute -left-[3.5px] -top-0.5 h-2 w-2 rounded-[1px] bg-[#3B66F5]" />
              </div>

              {/* Track 1: Caller waveform */}
              <div className="relative flex h-12 items-center gap-[3px] border-b border-[#1A2030]/80 pb-1">
                {UPPER_WAVE_BARS.map((height, idx) => {
                  const barRatio = idx / UPPER_WAVE_BARS.length;
                  const active = barRatio <= progressRatio;
                  return (
                    <div key={idx} className="flex h-full flex-1 items-center justify-center">
                      <span
                        style={{ height: `${height}%` }}
                        className={`w-[2px] rounded-full transition-colors duration-150 ${
                          active ? "bg-[#E2E8F5]" : "bg-[#6C768D]/65"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Track 2: Agent waveform */}
              <div className="relative mt-1 flex h-12 items-center gap-[3px] pt-1">
                {LOWER_WAVE_BARS.map((height, idx) => {
                  const barRatio = idx / LOWER_WAVE_BARS.length;
                  const active = barRatio <= progressRatio;
                  return (
                    <div key={idx} className="flex h-full flex-1 items-center justify-center">
                      <span
                        style={{ height: `${height}%` }}
                        className={`w-[2px] rounded-full transition-colors duration-150 ${
                          active ? "bg-[#3B66F5]" : "bg-[#273B7A]/70"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Bottom Time & Sample Axis */}
              <div className="mt-2.5 flex items-center justify-between font-mono text-[10px] text-[#6C768D] tabular-nums">
                <span>{formatTimer(elapsedSec)}</span>
                <span>{sampleCounter}</span>
                <span>{formatTimer(safeDuration)}</span>
              </div>

              {/* Floating Play / Pause Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                aria-label={isPlaying ? "Pause call recording" : "Play call recording"}
                className="absolute bottom-3 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-[#3B66F5] text-white shadow-[0_6px_20px_rgba(59,102,245,0.45)] transition-transform hover:scale-105 hover:bg-[#4B74FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                {isPlaying ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                    className="ml-0.5"
                  >
                    <polygon points="6 4 20 12 6 20 6 4" />
                  </svg>
                )}
              </button>
            </div>

            {/* Active Turn Transcript Line (Matching Screenshot) */}
            <div className="border-b border-[#1E2536] bg-[#10141F] px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <p className="font-['Space_Grotesk'] text-[13.5px] leading-[21px] text-[#DCE3F0]">
                  <span
                    className={`mr-1.5 font-mono text-[12px] font-semibold ${
                      activeTurn.speaker === "agent" ? "text-[#4D77FF]" : "text-[#8B95AC]"
                    }`}
                  >
                    {activeTurn.speaker}
                  </span>
                  <span className="mr-1.5 font-mono text-[11px] text-[#5B657D]">›</span>
                  <span className="font-medium text-white">{activeTurn.text}</span>
                </p>
              </div>

              {/* Turn Selector Dots */}
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  {CALL_TRANSCRIPT.map((turn, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const nextSec = (idx / CALL_TRANSCRIPT.length) * safeDuration;
                        setElapsedSec(nextSec);
                        if (audioRef.current) audioRef.current.currentTime = nextSec;
                      }}
                      aria-label={`Jump to turn ${idx + 1}: ${turn.speaker}`}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === activeTurnIndex
                          ? "w-4 bg-[#3B66F5]"
                          : "w-1.5 bg-[#262F45] hover:bg-[#3C4866]"
                      }`}
                    />
                  ))}
                </div>
                <span className="font-mono text-[10px] text-[#6C768D] tabular-nums">
                  turn {activeTurnIndex + 1}/{CALL_TRANSCRIPT.length}
                </span>
              </div>
            </div>

            {/* Bottom Telemetry / Tool Bar */}
            <div className="flex items-center justify-between bg-[#0D1017] px-4 py-2 font-mono text-[11px] text-[#4D77FF] tabular-nums">
              <span>{activeTurn.telemetry}</span>
              <Link
                href="/live-demo"
                className="text-[#8B95AC] transition-colors hover:text-white"
              >
                try live call →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export const HeroWithVoiceSample = Hero;