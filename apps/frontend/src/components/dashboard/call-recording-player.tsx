"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RecordingMeta = {
  id: string;
  callId: string;
  durationSeconds?: number | null;
  fileFormat?: string | null;
  status?: string | null;
  streamUrl: string;
};

type RecordingPayload = {
  ok: true;
  available: boolean;
  recording: RecordingMeta | null;
  message?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRecordingPayload(value: unknown): RecordingPayload | null {
  if (!isRecord(value) || value.ok !== true || typeof value.available !== "boolean") {
    return null;
  }

  if (!value.available || value.recording === null) {
    return {
      ok: true,
      available: false,
      recording: null,
      message: typeof value.message === "string" ? value.message : undefined,
    };
  }

  if (!isRecord(value.recording) || typeof value.recording.id !== "string") {
    return null;
  }

  const rec = value.recording;
  return {
    ok: true,
    available: true,
    recording: {
      id: rec.id as string,
      callId: typeof rec.callId === "string" ? rec.callId : (rec.id as string),
      durationSeconds: typeof rec.durationSeconds === "number" ? rec.durationSeconds : null,
      fileFormat: typeof rec.fileFormat === "string" ? rec.fileFormat : "mp3",
      status: typeof rec.status === "string" ? rec.status : null,
      streamUrl:
        typeof rec.streamUrl === "string" && rec.streamUrl.startsWith("/api/calls/")
          ? rec.streamUrl
          : `/api/calls/${encodeURIComponent(String(typeof rec.callId === "string" ? rec.callId : rec.id))}/recording/stream`,
    },
  };
}

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
}: {
  callId: string;
  initialHasRecording?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(initialHasRecording);
  const [recording, setRecording] = useState<RecordingMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState(false);
  const [retry, setRetry] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadRecordingMeta() {
      setLoading(true);
      setError(null);
      setAudioError(false);
      setIsPlaying(false);
      setCurrentTime(0);
      setMediaDuration(null);

      try {
        const response = await fetch(`/api/calls/${encodeURIComponent(callId)}/recording`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        const parsed = parseRecordingPayload(payload);

        if (!response.ok || !parsed) {
          throw new Error(
            isRecord(payload) && typeof payload.error === "string"
              ? payload.error
              : "Recording metadata could not be loaded.",
          );
        }

        if (!cancelled && !controller.signal.aborted) {
          setAvailable(parsed.available);
          setRecording(parsed.recording);
        }
      } catch (err) {
        if (controller.signal.aborted || cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load recording.");
        if (initialHasRecording) {
          setAvailable(true);
          setRecording({
            id: callId,
            callId,
            fileFormat: "mp3",
            streamUrl: `/api/calls/${encodeURIComponent(callId)}/recording/stream`,
          });
        } else {
          setAvailable(false);
        }
      } finally {
        if (!cancelled && !controller.signal.aborted) setLoading(false);
      }
    }

    void loadRecordingMeta();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [callId, initialHasRecording, retry]);

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
      // VBR / progressive streams often report a shorter estimated duration early on
      return Math.max(metaDur, domDur);
    }
    return metaDur ?? domDur ?? 0;
  }, [mediaDuration, recording?.durationSeconds]);

  const progressPercent = useMemo(() => {
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
          <span className="inline-flex items-center rounded-full border border-[#CDE5D4] bg-[#EFF8F1] px-2.5 py-1 font-['Space_Grotesk'] text-[12px] font-semibold text-[#34734B]">
            Ready
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-4 rounded-[6px] bg-[#FBFAF6] px-4 py-4 font-['Space_Grotesk'] text-[13px] text-[#85877F]" role="status">
          Checking recording availability…
        </div>
      ) : available ? (
        <div className="mt-4 space-y-3">
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
                  style={{ width: `${progressPercent}%` }}
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
                onClick={() => setRetry((n) => n + 1)}
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
      ) : (
        <div className="mt-4 rounded-[6px] bg-[#FBFAF6] px-4 py-4 font-['Space_Grotesk'] text-[13px] leading-5 text-[#85877F]">
          <p>{error || "Recording is not available for this call."}</p>
          {error ? (
            <button
              type="button"
              onClick={() => setRetry((n) => n + 1)}
              className="mt-2 font-['Space_Grotesk'] text-[13px] font-semibold text-[#7852D6] hover:underline"
            >
              Retry
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
