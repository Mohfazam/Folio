"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function loadRecordingMeta() {
      setLoading(true);
      setError(null);
      setAudioError(false);

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

  const streamUrl = `/api/calls/${encodeURIComponent(callId)}/recording/stream`;
  const fileFormat = (recording?.fileFormat || "mp3").toUpperCase();
  const downloadExt = (recording?.fileFormat || "mp3").toLowerCase();

  return (
    <section className="rounded-[8px] border border-[#ECEBE5] bg-white p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-['Space_Grotesk'] text-[14px] font-semibold text-[#1B1C18]">Recording</h2>
          <p className="mt-1 font-['Space_Grotesk'] text-[11px] text-[#85877F]">
            Audio recording, when retained and available.
          </p>
        </div>
        {available ? (
          <span className="inline-flex items-center rounded-full border border-[#CDE5D4] bg-[#EFF8F1] px-2.5 py-1 font-['Space_Grotesk'] text-[10px] font-semibold text-[#34734B]">
            Ready
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-4 rounded-[6px] bg-[#FBFAF6] px-4 py-4 font-['Space_Grotesk'] text-[11px] text-[#85877F]" role="status">
          Checking recording availability…
        </div>
      ) : available ? (
        <div className="mt-4 space-y-3">
          <audio
            controls
            preload="metadata"
            src={streamUrl}
            onError={() => setAudioError(true)}
            className="w-full"
          >
            Your browser does not support audio playback.
          </audio>

          {audioError ? (
            <div role="alert" className="rounded-[6px] border border-[#F0D8D4] bg-[#FFF8F7] px-3 py-2.5 font-['Space_Grotesk'] text-[11px] text-[#A33A32]">
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

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[#ECEBE5] bg-[#FBFAF6] px-3 py-2.5 font-['Space_Grotesk'] text-[11px] text-[#747878]">
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
        <div className="mt-4 rounded-[6px] bg-[#FBFAF6] px-4 py-4 font-['Space_Grotesk'] text-[11px] leading-5 text-[#85877F]">
          <p>{error || "Recording is not available for this call."}</p>
          {error ? (
            <button
              type="button"
              onClick={() => setRetry((n) => n + 1)}
              className="mt-2 font-['Space_Grotesk'] text-[11px] font-semibold text-[#7852D6] hover:underline"
            >
              Retry
            </button>
          ) : null}
        </div>
      )}
    </section>
  );
}
