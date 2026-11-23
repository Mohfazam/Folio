"use client";

import { useEffect, useMemo, useState } from "react";

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

function normalizeInitialTranscript(raw: unknown[] | undefined): TranscriptLine[] | null {
  if (!Array.isArray(raw)) return null;
  const lines: TranscriptLine[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    if (item.speaker !== "assistant" && item.speaker !== "user") continue;
    if (typeof item.text !== "string") continue;
    const timestamp =
      item.timestamp === null || item.timestamp === undefined
        ? null
        : typeof item.timestamp === "string"
          ? item.timestamp
          : null;
    lines.push({
      speaker: item.speaker,
      text: item.text,
      timestamp,
    });
  }
  return lines;
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

export function CallTranscript({
  callId,
  initialTranscript,
}: {
  callId: string;
  initialTranscript?: unknown[];
}) {
  const preloaded = useMemo(
    () => normalizeInitialTranscript(initialTranscript),
    [initialTranscript],
  );

  const [lines, setLines] = useState<TranscriptLine[]>(() => preloaded ?? []);
  const [total, setTotal] = useState<number | null>(() => (preloaded ? preloaded.length : null));
  const [loading, setLoading] = useState<boolean>(() => preloaded === null);
  const [unavailable, setUnavailable] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (preloaded !== null && retry === 0) {
      setLines(preloaded);
      setTotal(preloaded.length);
      setLoading(false);
      setUnavailable(false);
      return;
    }

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
            throw new Error("Transcript unavailable");
          }
          if (page.transcript.length === 0 && offset < page.total) {
            throw new Error("Transcript incomplete");
          }

          loaded = loaded.concat(page.transcript);
          offset += page.transcript.length;
          if (!cancelled) {
            setLines(loaded);
            setTotal(page.total);
            setUnavailable(false);
          }
          if (offset >= page.total || page.transcript.length === 0) break;
        }
      } catch (loadError) {
        console.error("[CallTranscript] Failed to load transcript:", loadError);
        if (!cancelled) {
          setTotal((current) => current ?? 0);
          setUnavailable(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadTranscript();
    return () => {
      cancelled = true;
    };
  }, [callId, preloaded, retry]);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <span className="inline-flex items-center rounded-full border border-[#E5E1D5] bg-[#F7F5EF] px-2.5 py-1 font-['Space_Grotesk'] text-[10px] font-semibold text-[#696B62]">
          {total === null ? (loading ? "Loading entries…" : "0 entries") : `${total} entries`}
        </span>
      </div>

      {lines.length > 0 ? (
        <div
          role="region"
          aria-label="Conversation transcript entries"
          tabIndex={0}
          className="max-h-[60vh] overflow-y-auto overscroll-contain pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] focus-visible:ring-offset-2"
        >
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
        </div>
      ) : null}

      {loading ? (
        <p className="rounded-[6px] bg-[#FBFAF6] px-4 py-4 font-['Space_Grotesk'] text-[11px] text-[#85877F]" role="status">
          {lines.length > 0 ? `Loading transcript… ${lines.length} of ${total ?? "all"} entries` : "Loading transcript…"}
        </p>
      ) : null}

      {!loading && lines.length === 0 ? (
        <div className="rounded-[6px] bg-[#FBFAF6] px-4 py-8 text-center font-['Space_Grotesk'] text-[11px] text-[#85877F]">
          <p>No transcript is available for this call.</p>
          {unavailable ? (
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                setUnavailable(false);
                setRetry((current) => current + 1);
              }}
              className="mt-2 font-['Space_Grotesk'] text-[11px] font-semibold text-[#7852D6] hover:underline"
            >
              Refresh
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
