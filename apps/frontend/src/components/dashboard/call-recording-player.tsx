"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRecordingStatus } from "../../hooks/useRecordingStatus";
import { RecordingProcessingProgress } from "./recording-processing-progress";

function formatClock(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const totalSecs = Math.floor(seconds);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || seconds < 0) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function CallRecordingPlayer({
  callId,
  initialHasRecording = false,
  callEndedAt,
}: {
  callId: string;
  initialHasRecording?: boolean;
  callEndedAt?: string | null;
}) {
  const {
    phase,
    available,
    recording,
    secondsRemaining,
    progressPercent,
    pollCount,
    error,
    checkNow,
    restartCountdown,
  } = useRecordingStatus(callId, {
    countdownSeconds: 60,
    pollIntervalMs: 8000,
    initialHasRecording,
    callEndedAt,
  });

  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  const effectiveDuration = useMemo(() => {
    const metaDur =
      recording?.durationSeconds && Number.isFinite(recording.durationSeconds) && recording.durationSeconds > 0
        ? recording.durationSeconds
        : null;
    const domDur =
      mediaDuration && Number.isFinite(mediaDuration) && mediaDuration > 0
        ? mediaDuration
        : null;

    if (metaDur && domDur) {
      return Math.max(metaDur, domDur);
    }
    return metaDur ?? domDur ?? 0;
  }, [mediaDuration, recording?.durationSeconds]);

  const streamProgressPercent = useMemo(() => {
    if (effectiveDuration <= 0) return 0;
    return Math.min(100, Math.max(0, (currentTime / effectiveDuration) * 100));
  }, [currentTime, effectiveDuration]);

  const syncDurationFromAudio = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (Number.isFinite(el.duration) && el.duration > 0) {
      setMediaDuration(el.duration);
    }
  }, []);

  const togglePlay = async () => {
    const el = audioRef.current;
    if (!el) return;
    setAudioError(false);
    try {
      if (el.paused) {
        await el.play();
      } else {
        el.pause();
      }
    } catch {
      setAudioError(true);
    }
  };

  const handleSeekChange = (nextSeconds: number) => {
    const clamped = Math.min(effectiveDuration || nextSeconds, Math.max(0, nextSeconds));
    setCurrentTime(clamped);
    const el = audioRef.current;
    if (el && Number.isFinite(clamped)) {
      el.currentTime = clamped;
    }
  };

  const toggleMute = () => {
    const el = audioRef.current;
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (el) {
      el.muted = nextMuted;
    }
  };

  const [justArrived, setJustArrived] = useState(false);
  const prevAvailableRef = useRef(available);

  // Trigger brief celebration animation when recording arrives via background polling
  if (!prevAvailableRef.current && available) {
    prevAvailableRef.current = true;
    setJustArrived(true);
    setTimeout(() => setJustArrived(false), 4500);
  }

  const streamUrl = `/api/calls/${encodeURIComponent(callId)}/recording/stream`;
  const fileFormat = (recording?.fileFormat || "mp3").toUpperCase();
  const downloadExt = (recording?.fileFormat || "mp3").toLowerCase();

  return (
    <section className="rounded-[8px] border border-[#ECEBE5] bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-['Space_Grotesk'] text-[15px] font-semibold text-[#1B1C18] sm:text-[16px]">Recording</h2>
          <p className="mt-1 font-['Space_Grotesk'] text-[13px] text-[#85877F]">
            Audio recording, when retained and available.
          </p>
        </div>
        {available ? (
          <span className="inline-flex items-center gap-1.5 rounded-[5px] border border-[#E6E5DD] bg-[#FAF9F5] px-2.5 py-1 font-['Space_Grotesk'] text-[12px] font-medium text-[#525552]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2F7A4D]" aria-hidden="true" />
            Audio ready
          </span>
        ) : null}
      </div>

      {phase === "checking" ? (
        <div className="mt-4 rounded-[6px] bg-[#FBFAF6] px-4 py-4 font-['Space_Grotesk'] text-[13px] text-[#85877F]" role="status">
          Checking recording availability…
        </div>
      ) : available && recording ? (
        <div className="mt-4 space-y-3">
          {justArrived ? (
            <div className="flex items-center gap-2 rounded-[6px] border border-[#C6E7D2] bg-[#F2FBF5] px-3 py-2 font-['Space_Grotesk'] text-[13px] font-medium text-[#1E6B3D] animate-fadeIn">
              <svg className="h-4 w-4 shrink-0 text-[#2F7A4D]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Recording processed and ready! Audio player loaded.</span>
            </div>
          ) : null}
          <audio
            ref={audioRef}
            preload="metadata"
            src={streamUrl}
            onLoadedMetadata={() => {
              syncDurationFromAudio();
              if (audioRef.current) setCurrentTime(audioRef.current.currentTime || 0);
            }}
            onDurationChange={syncDurationFromAudio}
            onTimeUpdate={() => {
              if (isSeeking || !audioRef.current) return;
              setCurrentTime(audioRef.current.currentTime || 0);
              syncDurationFromAudio();
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              setCurrentTime(effectiveDuration > 0 ? effectiveDuration : 0);
            }}
            onError={() => {
              setIsPlaying(false);
              setAudioError(true);
            }}
          />

          <div className="flex items-center gap-3 rounded-full bg-[#F1F3F4] px-3 py-2">
            <button
              type="button"
              onClick={() => void togglePlay()}
              aria-label={isPlaying ? "Pause recording" : "Play recording"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E2E5E9] text-[#1B1C18] transition-colors hover:bg-[#D5D9DF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
            >
              {isPlaying ? (
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg className="ml-0.5 h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                  <polygon points="6 4 20 12 6 20 6 4" />
                </svg>
              )}
            </button>

            <span className="shrink-0 font-['Space_Grotesk'] text-[13px] font-medium tabular-nums text-[#1B1C18]">
              {formatClock(currentTime)} / {formatClock(effectiveDuration)}
            </span>

            <div className="relative flex flex-1 items-center">
              <div className="h-1 w-full overflow-hidden rounded-full bg-[#C7CCD1]">
                <div
                  className="h-full rounded-full bg-[#1B1C18] transition-[width] duration-75"
                  style={{ width: `${streamProgressPercent}%` }}
                />
              </div>
              <input
                type="range"
                aria-label="Seek recording"
                min={0}
                max={effectiveDuration > 0 ? effectiveDuration : 100}
                step={0.1}
                value={Math.min(currentTime, effectiveDuration > 0 ? effectiveDuration : 100)}
                disabled={effectiveDuration <= 0}
                onMouseDown={() => setIsSeeking(true)}
                onTouchStart={() => setIsSeeking(true)}
                onChange={(e) => handleSeekChange(Number(e.target.value))}
                onMouseUp={() => setIsSeeking(false)}
                onTouchEnd={() => setIsSeeking(false)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
              />
            </div>

            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? "Unmute recording" : "Mute recording"}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[#1B1C18] transition-colors hover:bg-[#E2E5E9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
            >
              {muted ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5L6 9H2v6h4l5 4V5z" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                </svg>
              )}
            </button>
          </div>

          {audioError ? (
            <div role="alert" className="rounded-[6px] border border-[#F0D8D4] bg-[#FFF8F7] px-3 py-2.5 font-['Space_Grotesk'] text-[13px] text-[#A33A32]">
              Audio stream could not be played.{" "}
              <button
                type="button"
                onClick={checkNow}
                className="font-semibold underline hover:text-[#852F29]"
              >
                Retry
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[#ECEBE5] bg-[#FBFAF6] px-3 py-2.5 font-['Space_Grotesk'] text-[13px] text-[#747878]">
            <div className="flex flex-wrap items-center gap-3">
              <span>Format: <strong className="font-semibold text-[#1B1C18]">{fileFormat}</strong></span>
              {recording?.durationSeconds !== null && recording?.durationSeconds !== undefined ? (
                <span>Duration: <strong className="font-semibold text-[#1B1C18]">{formatDuration(recording.durationSeconds)}</strong></span>
              ) : null}
            </div>
            <a
              href={streamUrl}
              download={`call-${callId}.${downloadExt}`}
              className="font-semibold text-[#644ABB] underline underline-offset-2 hover:text-[#4C30A2]"
            >
              Download audio
            </a>
          </div>
        </div>
      ) : phase === "processing" || phase === "timeout" ? (
        <RecordingProcessingProgress
          secondsRemaining={secondsRemaining}
          progressPercent={progressPercent}
          pollCount={pollCount}
          onCheckNow={checkNow}
          onRestartTimer={restartCountdown}
          isTimeout={phase === "timeout"}
        />
      ) : (
        <div className="mt-4 rounded-[6px] bg-[#FBFAF6] px-4 py-4 font-['Space_Grotesk'] text-[13px] leading-5 text-[#85877F]">
          <p>{error || "Recording is not available for this call."}</p>
          <button
            type="button"
            onClick={checkNow}
            className="mt-2 font-['Space_Grotesk'] text-[13px] font-semibold text-[#7852D6] hover:underline"
          >
            Check status again
          </button>
        </div>
      )}
    </section>
  );
}
