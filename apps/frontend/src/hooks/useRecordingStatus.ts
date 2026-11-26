"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  RecordingMeta,
  RecordingPollOptions,
  RecordingState,
  RecordingStatusPhase,
} from "../features/calls/types/recording";

const DEFAULT_COUNTDOWN_SECONDS = 60;
const DEFAULT_POLL_INTERVAL_MS = 8000; // 8 seconds

export function useRecordingStatus(
  callId: string,
  options?: RecordingPollOptions
) {
  const countdownDuration = options?.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS;
  const pollIntervalMs = options?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const initialHasRecording = options?.initialHasRecording ?? false;
  const callEndedAt = options?.callEndedAt;

  // Determine if call is older than 5 minutes. If it ended long ago and has no recording,
  // we do not show a countdown, but we still verify once.
  const isOldCall = useRef(false);
  if (callEndedAt) {
    const elapsed = Date.now() - new Date(callEndedAt).getTime();
    if (elapsed > 5 * 60 * 1000) {
      isOldCall.current = true;
    }
  }

  const [state, setState] = useState<RecordingState>({
    phase: initialHasRecording ? "ready" : "checking",
    available: initialHasRecording,
    recording: initialHasRecording
      ? {
          id: callId,
          callId,
          fileFormat: "mp3",
          streamUrl: `/api/calls/${encodeURIComponent(callId)}/recording/stream`,
        }
      : null,
    secondsRemaining: countdownDuration,
    progressPercent: 0,
    error: null,
    isPolling: false,
    pollCount: 0,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeControllerRef = useRef<AbortController | null>(null);

  const fetchRecordingMeta = useCallback(async (isManualTrigger = false) => {
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeControllerRef.current = controller;

    try {
      const response = await fetch(`/api/calls/${encodeURIComponent(callId)}/recording`, {
        cache: "no-store",
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => null);

      if (controller.signal.aborted) return;

      if (response.ok && payload && typeof payload === "object" && payload.ok === true) {
        if (payload.available && payload.recording) {
          const rec = payload.recording;
          const recordingData: RecordingMeta = {
            id: rec.id || callId,
            callId: rec.callId || callId,
            durationSeconds: typeof rec.durationSeconds === "number" ? rec.durationSeconds : null,
            fileFormat: typeof rec.fileFormat === "string" ? rec.fileFormat : "mp3",
            status: typeof rec.status === "string" ? rec.status : "completed",
            streamUrl:
              typeof rec.streamUrl === "string" && rec.streamUrl.startsWith("/api/calls/")
                ? rec.streamUrl
                : `/api/calls/${encodeURIComponent(callId)}/recording/stream`,
          };

          setState((prev) => ({
            ...prev,
            phase: "ready",
            available: true,
            recording: recordingData,
            isPolling: false,
            error: null,
            progressPercent: 100,
          }));
          return true;
        }

        // Recording not yet ready
        setState((prev) => {
          const nextCount = prev.pollCount + 1;
          const nextPhase: RecordingStatusPhase =
            isOldCall.current && !isManualTrigger && nextCount > 1
              ? "timeout"
              : prev.secondsRemaining <= 0
              ? "timeout"
              : "processing";

          return {
            ...prev,
            phase: nextPhase,
            available: false,
            recording: null,
            pollCount: nextCount,
            error: null,
          };
        });
        return false;
      }

      throw new Error(payload?.error || "Failed to load recording metadata");
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : "Error checking recording status";
      setState((prev) => ({
        ...prev,
        error: message,
      }));
      return false;
    } finally {
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
    }
  }, [callId]);

  // Initial check and start polling loop
  useEffect(() => {
    if (initialHasRecording) {
      return;
    }

    let isMounted = true;

    // 1. Run immediate check
    void fetchRecordingMeta().then((found) => {
      if (!isMounted || found) return;

      // Start 1-second countdown ticker
      timerRef.current = setInterval(() => {
        setState((prev) => {
          if (prev.available || prev.phase === "ready") return prev;
          const nextSeconds = Math.max(0, prev.secondsRemaining - 1);
          const percent = Math.min(
            100,
            Math.round(((countdownDuration - nextSeconds) / countdownDuration) * 100)
          );

          return {
            ...prev,
            secondsRemaining: nextSeconds,
            progressPercent: percent,
            phase: nextSeconds === 0 ? "timeout" : "processing",
          };
        });
      }, 1000);

      // Start 8-second polling interval
      setState((prev) => ({ ...prev, isPolling: true }));
      pollTimerRef.current = setInterval(() => {
        if (stateRef.current.available || stateRef.current.phase === "ready") {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          return;
        }
        void fetchRecordingMeta();
      }, pollIntervalMs);
    });

    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      if (activeControllerRef.current) activeControllerRef.current.abort();
    };
  }, [callId, initialHasRecording, countdownDuration, pollIntervalMs, fetchRecordingMeta]);

  // Stop polling once ready
  useEffect(() => {
    if (state.available || state.phase === "ready") {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    }
  }, [state.available, state.phase]);

  const checkNow = useCallback(async () => {
    setState((prev) => ({ ...prev, phase: "checking" }));
    await fetchRecordingMeta(true);
  }, [fetchRecordingMeta]);

  const restartCountdown = useCallback(() => {
    setState((prev) => ({
      ...prev,
      phase: "processing",
      secondsRemaining: countdownDuration,
      progressPercent: 0,
      isPolling: true,
    }));
    void fetchRecordingMeta(true);
  }, [countdownDuration, fetchRecordingMeta]);

  return {
    ...state,
    checkNow,
    restartCountdown,
  };
}
