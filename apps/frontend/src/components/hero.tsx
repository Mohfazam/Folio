"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUser } from "@/lib/supabase/auth";
import { User } from "@supabase/supabase-js";

const AUDIO_SRC = "/hero-sample-call-hi.mp3";

const CALL_TRANSCRIPT: {
  speaker: "AI Agent" | "Customer";
  language: string;
  line: string;
}[] = [
  {
    speaker: "AI Agent",
    language: "English",
    line: "Hi Vikram, this is Priya calling from Aster Dental Clinic to confirm your consultation tomorrow at 10:30 AM with Dr. Mehta. Does that time still work for you?",
  },
  {
    speaker: "Customer",
    language: "Hindi",
    line: "Actually, kal subah office mein urgent kaam aa gaya hai. Kya hum Hindi mein baat kar sakte hain? Mujhe yeh Thursday afternoon ko shift karna hai.",
  },
  {
    speaker: "AI Agent",
    language: "Hindi",
    line: "Bilkul Vikram. Thursday ko dopahar 2:30 baje ya shaam 5:00 baje ka slot available hai. Kaunsa time aapke liye better rahega?",
  },
  {
    speaker: "Customer",
    language: "Telugu",
    line: "Shaam 5:00 baje thik rahega. Nenu Telugu lo matladavacha? Ee checkup ki mundu fasting emaina cheyala?",
  },
  {
    speaker: "AI Agent",
    language: "Telugu",
    line: "Tappakunda Vikram. Idi routine consultation kabatti fasting avasaram ledu. Meeru 10 minutes mundu ID tho randi. Mee appointment Thursday 5:00 PM ki confirm chesi WhatsApp ki details pampinchanu.",
  },
];

const WAVEFORM_HEIGHTS = [
  32, 68, 48, 88, 60, 96, 44, 78, 54, 92, 38, 74, 84, 50, 66, 90, 42, 72,
];

export const Hero = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [workEmail, setWorkEmail] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [durationSec, setDurationSec] = useState(52);

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

  const signUpHref = workEmail.trim()
    ? `/sign-up?email=${encodeURIComponent(workEmail.trim())}`
    : "/sign-up";

  const formatTimer = (sec: number) => {
    const whole = Math.floor(sec);
    const mins = Math.floor(whole / 60);
    const rem = whole % 60;
    return `${String(mins).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
  };

  const safeDuration = durationSec > 0 ? durationSec : 52;
  const activeTurnIndex = Math.min(
    CALL_TRANSCRIPT.length - 1,
    Math.floor((elapsedSec / safeDuration) * CALL_TRANSCRIPT.length)
  );

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

        {/* Right Column: Live Call Recording Player */}
        <div className="lg:col-span-6">
          <div className="overflow-hidden rounded-2xl border border-[#E3DFD3] bg-white shadow-[0_14px_40px_rgba(27,28,24,0.07)]">
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

            {/* Header bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E9E8E1] bg-[#FAFAF8] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22A06B] opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#22A06B]" />
                </span>
                <span className="font-['Space_Grotesk'] text-[11px] font-semibold uppercase tracking-[0.8px] text-[#1B1C18]">
                  Unedited Call Recording
                </span>
              </div>

              <span className="rounded-md border border-[#E3DFD3] bg-[#F5F3EC] px-2.5 py-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#1B1C18]">
                English · Hindi · Telugu
              </span>
            </div>

            {/* Agent details & Audio Waveform Player */}
            <div className="border-b border-[#E9E8E1] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-['Space_Grotesk'] text-[13px] font-bold text-[#1B1C18]">
                    Priya · Appointment Desk
                  </p>
                  <p className="mt-0.5 font-['Space_Grotesk'] text-[12px] text-[#525552]">
                    Aster Dental Clinic · Live Reschedule &amp; WhatsApp Sync
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-[#F5F3EC] px-2 py-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#1B1C18] tabular-nums">
                    240ms latency
                  </span>
                  <span className="rounded-md bg-[#E3FCEF] px-2 py-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#166534]">
                    Barge-in Active
                  </span>
                </div>
              </div>

              {/* Audio control bar */}
              <div className="mt-4 flex items-center gap-3.5 rounded-xl border border-[#EAE6DC] bg-[#FBF9F2] px-4 py-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? "Pause call recording" : "Play call recording"}
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

            {/* Transcript */}
            <div className="flex max-h-[290px] flex-col gap-2.5 overflow-y-auto bg-white p-5">
              {CALL_TRANSCRIPT.map((turn, index) => {
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
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.8px] ${
                            turn.speaker === "AI Agent" ? "text-[#FD7032]" : "text-[#525552]"
                          }`}
                        >
                          {turn.speaker}
                        </span>
                        <span className="rounded bg-[#F5F3EC] px-1.5 py-0.5 font-['Space_Grotesk'] text-[9.5px] font-semibold text-[#525552]">
                          {turn.language}
                        </span>
                      </div>
                      {index === CALL_TRANSCRIPT.length - 1 && (
                        <span className="rounded bg-[#E3FCEF] px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold text-[#166534]">
                          Rescheduled · Thu 5:00 PM
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

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E9E8E1] bg-[#FAFAF8] px-5 py-3">
              <div className="flex items-center gap-3 font-['Space_Grotesk'] text-[11px] font-medium text-[#525552] tabular-nums">
                <span>Effective rate: ₹4.20/min</span>
                <span aria-hidden="true">•</span>
                <span>WhatsApp confirmation synced</span>
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

export const HeroWithVoiceSample = Hero;