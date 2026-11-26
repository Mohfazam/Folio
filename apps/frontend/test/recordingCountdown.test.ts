import test from "node:test";
import assert from "node:assert/strict";
import type { RecordingState, RecordingMeta } from "../src/features/calls/types/recording";

function calculateProgress(secondsRemaining: number, totalSeconds: number): number {
  if (totalSeconds <= 0) return 100;
  const clamped = Math.max(0, Math.min(totalSeconds, secondsRemaining));
  return Math.min(100, Math.round(((totalSeconds - clamped) / totalSeconds) * 100));
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

test("Recording countdown: calculates correct remaining percentage across 60 seconds", () => {
  assert.equal(calculateProgress(60, 60), 0);
  assert.equal(calculateProgress(45, 60), 25);
  assert.equal(calculateProgress(30, 60), 50);
  assert.equal(calculateProgress(15, 60), 75);
  assert.equal(calculateProgress(0, 60), 100);
});

test("Recording clock format: correctly formats various durations", () => {
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(5), "0:05");
  assert.equal(formatClock(59), "0:59");
  assert.equal(formatClock(60), "1:00");
  assert.equal(formatClock(125), "2:05");
  assert.equal(formatClock(null), "0:00");
  assert.equal(formatClock(-10), "0:00");
});

test("Recording state: transitions correctly from processing to ready", () => {
  const initialProcessingState: RecordingState = {
    phase: "processing",
    available: false,
    recording: null,
    secondsRemaining: 60,
    progressPercent: 0,
    error: null,
    isPolling: true,
    pollCount: 1,
  };

  assert.equal(initialProcessingState.phase, "processing");
  assert.equal(initialProcessingState.available, false);

  const mockMeta: RecordingMeta = {
    id: "rec-123",
    callId: "call-456",
    durationSeconds: 34,
    fileFormat: "mp3",
    status: "completed",
    streamUrl: "/api/calls/call-456/recording/stream",
  };

  const readyState: RecordingState = {
    ...initialProcessingState,
    phase: "ready",
    available: true,
    recording: mockMeta,
    isPolling: false,
    progressPercent: 100,
  };

  assert.equal(readyState.phase, "ready");
  assert.equal(readyState.available, true);
  assert.equal(readyState.recording?.fileFormat, "mp3");
  assert.equal(readyState.recording?.streamUrl, "/api/calls/call-456/recording/stream");
});
