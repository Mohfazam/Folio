"use client";

import { useState } from "react";

interface RecordingProcessingProgressProps {
  secondsRemaining: number;
  progressPercent: number;
  pollCount: number;
  onCheckNow?: () => void;
  onRestartTimer?: () => void;
  isTimeout?: boolean;
}

export function RecordingProcessingProgress({
  secondsRemaining,
  progressPercent,
  pollCount,
  onCheckNow,
  onRestartTimer,
  isTimeout = false,
}: RecordingProcessingProgressProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const handleManualSync = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/calls/sync-recordings", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setSyncMessage(`Synced ${data.matchedCount ?? 0} recording(s) successfully!`);
        if (onCheckNow) {
          setTimeout(onCheckNow, 1000);
        }
      } else {
        setSyncMessage(data?.error || "Sync in progress...");
        if (onCheckNow) onCheckNow();
      }
    } catch {
      setSyncMessage("Sync request sent. Checking recording status...");
      if (onCheckNow) onCheckNow();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="mt-4 rounded-[8px] border border-[#E9E5F5] bg-[#FAF8FE] p-4 text-[#1B1C18]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7852D6] opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-[#7852D6]" />
          </span>
          <span className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#5A38B8]">
            {isTimeout
              ? "Plivo is finalizing audio file"
              : "Processing recording… audio is typically available within ~60 seconds."}
          </span>
        </div>

        {!isTimeout ? (
          <span className="shrink-0 rounded-[5px] bg-[#EDE8FA] px-2 py-0.5 font-['Space_Grotesk'] text-[12px] font-medium tabular-nums text-[#6E42D0]">
            {secondsRemaining}s remaining
          </span>
        ) : (
          <span className="shrink-0 rounded-[5px] bg-[#EDE8FA] px-2 py-0.5 font-['Space_Grotesk'] text-[12px] font-medium text-[#6E42D0]">
            Waiting on Plivo
          </span>
        )}
      </div>

      {/* 60-Second Progress Bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#E5DFFA]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#7852D6] to-[#9973EB] transition-all duration-300 ease-out"
          style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
        />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 font-['Space_Grotesk'] text-[12px] text-[#7C7495]">
        <span>
          {isTimeout
            ? "Longer calls can take up to 90s to encode. Auto-checking every 8s..."
            : `Checking Plivo media service (check #${pollCount})...`}
        </span>

        <div className="flex items-center gap-3">
          {onRestartTimer && isTimeout ? (
            <button
              type="button"
              onClick={onRestartTimer}
              className="font-medium text-[#7852D6] hover:underline"
            >
              Restart timer
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className="font-medium text-[#7852D6] underline underline-offset-2 hover:text-[#5833B5] disabled:opacity-50"
          >
            {isSyncing ? "Syncing..." : "Sync from Plivo"}
          </button>

          {onCheckNow ? (
            <button
              type="button"
              onClick={onCheckNow}
              className="font-medium text-[#7852D6] underline underline-offset-2 hover:text-[#5833B5]"
            >
              Check now
            </button>
          ) : null}
        </div>
      </div>

      {syncMessage ? (
        <div className="mt-2 text-[11px] font-medium text-[#5A38B8]">
          {syncMessage}
        </div>
      ) : null}
    </div>
  );
}
