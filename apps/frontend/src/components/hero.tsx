"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getCurrentUser } from "@/lib/supabase/auth";
import { User } from "@supabase/supabase-js";

const AUDIO_SRC = "/samples/hero-sample-call-hi.mp3";

type TranscriptTurn = {
  speaker: "agent" | "caller";
  language: string;
  startSec: number;
  line: string;
  meta: string;
};

const CALL_TRANSCRIPT: TranscriptTurn[] = [
  {
    speaker: "agent",
    language: "Hinglish",
    startSec: 0.0,
    line: "Hello, Bright Smile Dental mein aapka swagat hai, main Priya bol rahi hoon. Bataiye, main aapki kaise help kar sakti hoon?",
    meta: "00:00 – 00:06 · tool: greet_caller",
  },
  {
    speaker: "caller",
    language: "Hinglish",
    startSec: 7.0,
    line: "Hello, haan, mujhe apni Friday wali appointment reschedule karni hai.",
    meta: "00:07 – 00:11 · intent: reschedule",
  },
  {
    speaker: "agent",
    language: "Hinglish",
    startSec: 12.0,
    line: "Sure, main abhi dekhti hoon. Kya aap apna booking ID ya naam bata sakte hain?",
    meta: "00:12 – 00:16 · tool: lookup_prompt",
  },
  {
    speaker: "caller",
    language: "Hinglish",
    startSec: 17.0,
    line: "Haan, note kijiye B-4-2-8-1, Rahul Sharma ke naam se hoga.",
    meta: "00:17 – 00:23 · booking_ref: B-4-2-8-1",
  },
  {
    speaker: "agent",
    language: "Hinglish",
    startSec: 24.0,
    line: "Mil gaya Rahul ji, ek minute.",
    meta: "00:24 – 00:26 · tool: get_booking",
  },
  {
    speaker: "agent",
    language: "Hinglish",
    startSec: 26.0,
    line: "Aapki cleaning hai Dr. Patel ke saath Friday 11 baje.",
    meta: "00:26 – 00:29 · booking: Fri 11:00 AM",
  },
  {
    speaker: "agent",
    language: "Hinglish",
    startSec: 30.0,
    line: "Kab move karna chahenge?",
    meta: "00:30 – 00:31 · prompt: target_time",
  },
  {
    speaker: "caller",
    language: "Hinglish",
    startSec: 32.0,
    line: "Agle hafte koi bhi time chalega mujhe.",
    meta: "00:32 – 00:34 · window: next_week",
  },
  {
    speaker: "caller",
    language: "Hinglish",
    startSec: 35.0,
    line: "Tuesday possible hai kya?",
    meta: "00:35 – 00:36 · preferred_day: Tue",
  },
  {
    speaker: "agent",
    language: "Hinglish",
    startSec: 37.0,
    line: "Tuesday check karti hoon.",
    meta: "00:37 – 00:38 · tool: check_slots",
  },
  {
    speaker: "agent",
    language: "Hinglish",
    startSec: 39.0,
    line: "Dr. Patel ke saath 3 PM ka slot available hai. Chalega?",
    meta: "00:39 – 00:42 · slot: Tue 3:00 PM",
  },
  {
    speaker: "caller",
    language: "Hinglish",
    startSec: 44.0,
    line: "Haan... haan, theek hai, chalega.",
    meta: "00:44 – 00:45 · slot_confirmed: Tue 3:00 PM",
  },
  {
    speaker: "agent",
    language: "Hinglish",
    startSec: 46.0,
    line: "Tuesday 3 baje book kar diya.",
    meta: "00:46 – 00:48 · tool: book_appointment",
  },
  {
    speaker: "agent",
    language: "Hinglish",
    startSec: 48.0,
    line: "Aur confirmation aapke phone pe aa jayega.",
    meta: "00:48 – 00:50 · sms_queued",
  },
  {
    speaker: "agent",
    language: "Hinglish",
    startSec: 50.0,
    line: "Aur kuch help chahiye?",
    meta: "00:50 – 00:51 · prompt: follow_up",
  },
  {
    speaker: "caller",
    language: "Hinglish",
    startSec: 52.0,
    line: "Nahi, aur kuch nahi. Thanks.",
    meta: "00:52 – 00:53 · call_state: wrap_up",
  },
  {
    speaker: "agent",
    language: "Hinglish",
    startSec: 53.0,
    line: "Of course, aapka din shubh ho Rahul ji.",
    meta: "00:53 – 00:57 · Rescheduled · Tue 3:00 PM",
  },
];

const WAVEFORM_HEIGHTS = [
  32, 68, 48, 88, 60, 96, 44, 78, 54, 92, 38, 74, 84, 50, 66, 90, 42, 72,
];

function getTurnIndexAtTime(sec: number): number {
  let currentIdx = 0;
  for (let i = 0; i < CALL_TRANSCRIPT.length; i++) {
    if (sec >= CALL_TRANSCRIPT[i].startSec) {
      currentIdx = i;
    } else {
      break;
    }
  }
  return currentIdx;
}

export const Hero = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [workEmail, setWorkEmail] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [durationSec, setDurationSec] = useState(57);

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

  const jumpToTurn = async (index: number) => {
    const clamped = Math.min(CALL_TRANSCRIPT.length - 1, Math.max(0, index));
    const targetSec = CALL_TRANSCRIPT[clamped].startSec;

    setElapsedSec(targetSec);
    if (audioRef.current) {
      audioRef.current.currentTime = targetSec;
      if (!isPlaying) {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch {
          // Ignore autoplay restriction if triggered without play toggle
        }
      }
    }
  };

  const handleWaveformSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const safeDur = durationSec > 0 ? durationSec : 57;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const nextSec = ratio * safeDur;
    setElapsedSec(nextSec);
    if (
      audioRef.current &&
      Number.isFinite(audioRef.current.duration) &&
      audioRef.current.duration > 0
    ) {
      audioRef.current.currentTime = nextSec;
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

  const safeDuration = durationSec > 0 ? durationSec : 57;
  const activeTurnIndex = getTurnIndexAtTime(elapsedSec);
  const activeTurn = CALL_TRANSCRIPT[activeTurnIndex];

  const nextTurnStart =
    activeTurnIndex < CALL_TRANSCRIPT.length - 1
      ? CALL_TRANSCRIPT[activeTurnIndex + 1].startSec
      : safeDuration;
  const turnSpan = Math.max(0.5, nextTurnStart - activeTurn.startSec);
  const turnProgressPct = Math.min(
    100,
    Math.max(0, ((elapsedSec - activeTurn.startSec) / turnSpan) * 100)
  );

  return (
    <section
      id="demo"
      className="relative mx-auto w-full max-w-[1280px] overflow-hidden px-6 pb-20 pt-10 md:px-10 md:pb-28 md:pt-16"
    >
      <style jsx>{`
        @keyframes turnSwap {
          0% {
            opacity: 0;
            transform: translateY(7px) scale(0.99);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        .turn-swap-anim {
          animation: turnSwap 280ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
      `}</style>

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
                Hinglish
              </span>
            </div>

            {/* Agent details & Audio Waveform Player */}
            <div className="border-b border-[#E9E8E1] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-['Space_Grotesk'] text-[13px] font-bold text-[#1B1C18]">
                    Priya · Bright Smile Dental
                  </p>
                  <p className="mt-0.5 font-['Space_Grotesk'] text-[12px] text-[#525552]">
                    Rahul Sharma (ID B-4-2-8-1) · Dr. Patel Reschedule
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
                  onClick={handleWaveformSeek}
                  className="flex h-8 flex-1 cursor-pointer items-center justify-between gap-1"
                  title="Click to seek"
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

            {/* Dynamic Active Turn Transcript */}
            <div className="bg-white p-5">
              <div
                className={`relative overflow-hidden rounded-xl border p-4 transition-all duration-300 ${
                  isPlaying
                    ? "border-[#FD7032]/45 bg-[#FFFDF9] shadow-[0_6px_20px_rgba(253,112,50,0.08)]"
                    : "border-[#EAE6DC] bg-[#FCFBF8]"
                }`}
              >
                {/* Live turn progress bar along top edge */}
                <div className="absolute inset-x-0 top-0 h-[2px] bg-[#EFECE4]">
                  <div
                    style={{ width: `${turnProgressPct}%` }}
                    className="h-full bg-[#FD7032] transition-[width] duration-150 ease-linear"
                  />
                </div>

                <div
                  key={`meta-${activeTurnIndex}`}
                  className="turn-swap-anim flex items-center justify-between gap-2 pt-0.5"
                >
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${
                        activeTurn.speaker === "agent"
                          ? isPlaying
                            ? "animate-ping bg-[#FD7032]"
                            : "bg-[#FD7032]"
                          : "bg-[#1B1C18]"
                      }`}
                    />
                    <span
                      className={`font-semibold ${
                        activeTurn.speaker === "agent" ? "text-[#FD7032]" : "text-[#525552]"
                      }`}
                    >
                      {activeTurn.speaker}
                    </span>
                    <span className="text-[#9A9E9A]">›</span>
                    <span className="rounded bg-[#F5F3EC] px-1.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold text-[#525552]">
                      {activeTurn.language}
                    </span>
                  </div>

                  <span className="font-mono text-[10.5px] text-[#525552] tabular-nums">
                    {activeTurn.meta}
                  </span>
                </div>

                <p
                  key={`line-${activeTurnIndex}`}
                  className="turn-swap-anim mt-2 font-['Space_Grotesk'] text-[13.5px] font-medium leading-[21px] text-[#1B1C18]"
                >
                  {activeTurn.line}
                </p>

                <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-[#F0EDE5] pt-2.5">
                  <div className="flex items-center gap-1.5">
                    {CALL_TRANSCRIPT.map((turn, idx) => {
                      const isCurrent = idx === activeTurnIndex;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => jumpToTurn(idx)}
                          aria-label={`Jump to ${turn.speaker} line ${idx + 1}`}
                          className={`h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FD7032] ${
                            isCurrent
                              ? "w-6 bg-[#FD7032]"
                              : idx < activeTurnIndex
                                ? "w-1.5 bg-[#1B1C18]/55 hover:bg-[#1B1C18]"
                                : "w-1.5 bg-[#DCD8CC] hover:bg-[#1B1C18]/40"
                          }`}
                        />
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[10.5px] text-[#525552] tabular-nums">
                    <button
                      type="button"
                      onClick={() => jumpToTurn(activeTurnIndex - 1)}
                      disabled={activeTurnIndex === 0}
                      className="rounded px-1.5 py-0.5 transition-colors hover:bg-[#F5F3EC] hover:text-[#1B1C18] disabled:opacity-35"
                    >
                      prev
                    </button>
                    <span>
                      {activeTurnIndex + 1}/{CALL_TRANSCRIPT.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => jumpToTurn(activeTurnIndex + 1)}
                      disabled={activeTurnIndex === CALL_TRANSCRIPT.length - 1}
                      className="rounded px-1.5 py-0.5 transition-colors hover:bg-[#F5F3EC] hover:text-[#1B1C18] disabled:opacity-35"
                    >
                      next
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E9E8E1] bg-[#FAFAF8] px-5 py-3">
              <div className="flex items-center gap-3 font-['Space_Grotesk'] text-[11px] font-medium text-[#525552] tabular-nums">
                <span>Effective rate: ₹4.20/min</span>
                <span aria-hidden="true">•</span>
                <span>Booking B-4-2-8-1 updated</span>
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