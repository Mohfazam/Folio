// Created as part of Foolioo Call Recording integration
export const recording_version = '1.0.0';

export type RecordingStatusPhase =
  | 'idle'
  | 'checking'
  | 'processing'
  | 'ready'
  | 'timeout'
  | 'error';

export interface RecordingMeta {
  id: string;
  callId: string;
  durationSeconds?: number | null;
  fileFormat?: string | null;
  status?: string | null;
  streamUrl: string;
}

export interface RecordingPollOptions {
  /** Maximum duration in seconds for the initial processing countdown (default: 60) */
  countdownSeconds?: number;
  /** Polling interval in milliseconds while processing (default: 8000ms / 8s) */
  pollIntervalMs?: number;
  /** Whether recording was already confirmed available upfront */
  initialHasRecording?: boolean;
  /** ISO timestamp of when the call completed, to avoid countdowns on old calls */
  callEndedAt?: string | null;
}

export interface RecordingState {
  phase: RecordingStatusPhase;
  available: boolean;
  recording: RecordingMeta | null;
  secondsRemaining: number;
  progressPercent: number;
  error: string | null;
  isPolling: boolean;
  pollCount: number;
}
