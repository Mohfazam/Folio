"use client";

import { useEffect, useState } from "react";

type TranscriptLine = {
  speaker: "assistant" | "user";
  text: string;
  timestamp: string | null;
};

type TranscriptPayload = {
  ok: true;
  transcript: TranscriptLine[];
  total: number;
};

const PAGE_SIZE = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTranscriptPayload(value: unknown): TranscriptPayload | null {
  if (
    !isRecord(value) ||
    value.ok !== true ||
    !Array.isArray(value.transcript) ||
    typeof value.total !== "number" ||
    !Number.isSafeInteger(value.total) ||
    value.total < 0
  ) {
    return null;
  }

  const transcript: TranscriptLine[] = [];
  for (const item of value.transcript) {
    if (
      !isRecord(item) ||
      (item.speaker !== "assistant" && item.speaker !== "user") ||
      typeof item.text !== "string" ||
      (item.timestamp !== null && typeof item.timestamp !== "string")
    ) {
      return null;
    }

    transcript.push({
      speaker: item.speaker,
      text: item.text,
      timestamp: item.timestamp,
    });
  }

  if (transcript.length > PAGE_SIZE) return null;
  return { ok: true, transcript, total: value.total };
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Time unavailable"
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function CallTranscript({ callId }: { callId: string }) {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadTranscript() {
      let offset = 0;
      let loaded: TranscriptLine[] = [];
      try {
        while (true) {
          const response = await fetch(
            `/api/calls/${encodeURIComponent(callId)}/transcript?offset=${offset}&limit=${PAGE_SIZE}`,
            { cache: "no-store" },
          );
          const payload = await response.json().catch(() => null);
          const page = parseTranscriptPayload(payload);
          if (!response.ok || !page) {
            const message = isRecord(payload) && typeof payload.error === "string"
              ? payload.error
              : `Transcript request failed (${response.status}).`;
            throw new Error(message);
          }
          if (page.transcript.length === 0 && offset < page.total) {
            throw new Error("The transcript response ended before all entries were loaded.");
          }

          loaded = loaded.concat(page.transcript);
          offset += page.transcript.length;
          if (!cancelled) {
            setLines(loaded);
            setTotal(page.total);
          }
          if (offset >= page.total || page.transcript.length === 0) break;
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load the transcript.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTranscript();
    return () => {
      cancelled = true;
    };
  }, [callId, retry]);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <span className="inline-flex items-center rounded-full border border-[#E5E1D5] bg-[#F7F5EF] px-2.5 py-1 font-['Space_Grotesk'] text-[10px] font-semibold text-[#696B62]">
          {total === null ? (loading ? "Loading entries…" : "0 entries") : `${total} entries`}
        </span>
      </div>

      {lines.length > 0 ? (
        <div className="space-y-3">
          {lines.map((line, index) => {
            const assistant = line.speaker === "assistant";
            return (
              <div key={`${index}-${line.timestamp ?? "transcript"}`} className={`flex ${assistant ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[92%] rounded-[9px] border px-3.5 py-3 sm:max-w-[82%] ${assistant ? "border-[#ECEBE5] bg-[#F8F7F2]" : "border-[#E7E0F3] bg-[#F5F1FB]"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <span className={`font-['Space_Grotesk'] text-[9px] font-bold uppercase tracking-[0.08em] ${assistant ? "text-[#747878]" : "text-[#806DB2]"}`}>{assistant ? "FOOLIOO AGENT" : "CONTACT"}</span>
                    {line.timestamp ? <time className="font-['Space_Grotesk'] text-[9px] text-[#92938C]">{formatTimestamp(line.timestamp)}</time> : null}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap break-words font-['Space_Grotesk'] text-[12px] leading-5 text-[#34362E]">{line.text || "[No transcript text]"}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {loading ? (
        <p className="rounded-[6px] bg-[#FBFAF6] px-4 py-4 font-['Space_Grotesk'] text-[11px] text-[#85877F]" role="status">
          {lines.length > 0 ? `Loading transcript… ${lines.length} of ${total ?? "all"} entries` : "Loading transcript…"}
        </p>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-[6px] border border-[#F0D8D4] bg-[#FFF8F7] px-4 py-3">
          <p className="font-['Space_Grotesk'] text-[11px] text-[#A33A32]">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(null);
              setRetry((current) => current + 1);
            }}
            className="mt-2 font-['Space_Grotesk'] text-[11px] font-semibold text-[#7852D6] hover:underline"
          >
            Retry transcript
          </button>
        </div>
      ) : null}

      {!loading && !error && lines.length === 0 ? (
        <div className="rounded-[6px] bg-[#FBFAF6] px-4 py-8 text-center font-['Space_Grotesk'] text-[11px] text-[#85877F]">
          No transcript is available for this call.
        </div>
      ) : null}
    </div>
  );
}
