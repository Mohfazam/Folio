/**
 * Calling Service API Contract — v1
 *
 * Types shared between the calling service and the main service.
 * The calling service pushes call results to the main service after each call.
 *
 * Schema version: 1.0
 */

import type { PromptContext } from "../prompts/compileSystemPrompt.js";

// ── Call Request (main service → calling service) ──────────────────

export interface CallRequest {
  /** Stable correlation ID from the main service (UUID v4) */
  requestId: string;
  /** Contact identifier in the main service */
  contactId: string;
  /** Client/business identifier */
  clientId: string;
  /** Queue entry that dispatched this call, when called by the backend worker */
  queueEntryId?: string;
  /** Optional campaign identifier */
  campaignId?: string;
  /** Destination phone number in E.164 format (e.g. +91XXXXXXXXXX) */
  phoneNumber: string;
  /** Language preference for STT/TTS (e.g. "en-IN", "hi-IN"). Defaults to "en-IN". */
  language?: string;
  /** Optional call-specific instructions appended to the AI system prompt */
  instructions?: string;
  /** Optional structured context compiled into the system prompt */
  context?: PromptContext;
  /** Optional custom greeting text played when call connects */
  greetingText?: string;
  /** Optional webhook callback URL where final CallResult is posted when call ends */
  callbackUrl?: string;
  /** Whether to record this call with Plivo */
  recordCall?: boolean;
}

// ── Call Status ─────────────────────────────────────────────────────

export type CallStatus =
  | "completed" // Normal call completion (caller hung up or conversation ended)
  | "failed" // Unrecoverable error during the call
  | "interrupted" // Call cut short by provider issues but some conversation occurred
  | "no_input" // Call connected but caller never spoke
  | "no_answer" // Plivo reported no answer / busy / unreachable
  | "delivery_pending"; // Call ended but result not yet delivered to main service

// ── Failure Categories ──────────────────────────────────────────────

export type FailureCategory =
  | "stt_connection" // STT WebSocket failed to connect
  | "stt_stream" // STT error during streaming
  | "model_request" // Gemini API error or timeout
  | "model_timeout" // Gemini took too long
  | "model_empty" // Gemini returned empty response
  | "tts_connection" // TTS WebSocket failed to connect
  | "tts_synthesis" // TTS error during audio synthesis
  | "tts_playback" // Error playing audio back to Plivo
  | "plivo_stream" // Plivo media stream error
  | "plivo_disconnect" // Unexpected Plivo disconnect
  | "plivo_dial" // Failed to initiate the call via Plivo API
  | "delivery_failed" // Could not deliver final result to main service
  | "recording_failed" // Recording capture or upload failed
  | "unknown"; // Catch-all

// ── Transcript ──────────────────────────────────────────────────────

export interface TranscriptTurn {
  /** "user" for caller speech, "assistant" for AI speech */
  speaker: "user" | "assistant";
  /** The text content of this turn */
  text: string;
  /** ISO 8601 timestamp when this turn was captured */
  timestamp: string;
  /** Whether this turn was fully completed (TTS fully played for assistant, final transcript for user) */
  isComplete: boolean;
}

// ── Provider Error Record ───────────────────────────────────────────

export interface ProviderErrorRecord {
  /** Pipeline stage where the error occurred */
  stage: "stt" | "model" | "tts" | "plivo" | "delivery" | "recording";
  /** Categorised failure type */
  category: FailureCategory;
  /** Human-readable error message (never contains secrets) */
  message: string;
  /** Number of retry attempts made for this operation */
  retryCount: number;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Whether the operation could safely be retried */
  retryable: boolean;
}

// ── Recording Metadata ──────────────────────────────────────────────

export interface RecordingMetadata {
  /** Storage key or path for the recording (not a raw public URL) */
  storageKey?: string;
  /** Duration in seconds */
  durationSeconds?: number;
  /** File size in bytes */
  sizeBytes?: number;
  /** MIME type of the recording file */
  mimeType?: string;
  /** Whether the recording is available for retrieval */
  available: boolean;
  /**
   * If not available, the reason.
   * e.g. "recording_not_configured", "upload_failed", "plivo_callback_pending"
   */
  unavailableReason?: string;
}

// ── Call Result (calling service → main service) ────────────────────

export interface CallResult {
  /** Schema version for forward compatibility */
  schemaVersion: "1.0";

  /** Stable delivery ID for idempotent delivery: `${requestId}:${plivoCallId}` */
  deliveryId: string;

  /** Correlation ID from the original CallRequest */
  requestId: string;
  /** Plivo call UUID assigned when the call was created */
  plivoCallId: string;
  /** Contact ID from the main service */
  contactId: string;
  /** Client ID */
  clientId: string;
  /** Queue entry that dispatched this call, when applicable */
  queueEntryId?: string;

  /** Terminal call status */
  status: CallStatus;
  /** Primary failure category when status is "failed" or "interrupted" */
  failureCategory?: FailureCategory;
  /** Human-readable failure reason */
  failureReason?: string;
  /**
   * Whether the main service should retry this contact.
   * The calling service sets this flag; the main service owns the retry decision.
   */
  retryable: boolean;

  /** ISO 8601 timestamp when the call was initiated */
  startedAt: string;
  /** ISO 8601 timestamp when the call ended */
  endedAt: string;
  /** Call duration in seconds */
  durationSeconds: number;

  /** Ordered transcript turns as they occurred during the call */
  transcript: TranscriptTurn[];

  /** Recording metadata, present if recording was attempted */
  recording?: RecordingMetadata;

  /** All provider errors encountered during the call */
  providerErrors: ProviderErrorRecord[];

  /** Latency timing metrics for performance analysis */
  timings: {
    /** Time from call start to STT WebSocket ready (ms) */
    sttConnectMs?: number;
    /** Time from call start to greeting audio played (ms) */
    greetingPlayedMs?: number;
    /** Average time from user transcript final to first AI sentence (ms) */
    avgFirstSentenceMs?: number;
    /** Average time from user transcript final to first TTS audio chunk (ms) */
    avgFirstAudioMs?: number;
  };

  /** AI post-call analysis extracting outcome, sentiment, and summary */
  analysis?: CallAnalysisResult;

  /** Calculated credits and estimated provider infrastructure costs */
  costEstimate?: {
    credits: number;
    costTelephony?: number;
    costStt?: number;
    costLlm?: number;
    costTts?: number;
    totalEstimatedCost?: number;
  };
}

// ── Call Analysis Result ────────────────────────────────────────────

export interface CallAnalysisResult {
  /** 1-2 sentence summary of what was discussed */
  summary: string;
  /** Evaluated interest level of the caller */
  interestLevel: "high" | "medium" | "low" | "unknown";
  /** Overall caller sentiment during the conversation */
  sentiment: "positive" | "neutral" | "negative";
  /** Specific objections, hesitation, or pain points raised */
  objectionsRaised: string[];
  /** Whether the caller requested a callback or follow-up */
  followUpRequested: boolean;
  /** Explicit callback time requested, if any */
  requestedCallbackTime?: string;
  /** Additional notes or next steps for human sales / support reps */
  notes?: string;
}

// ── API Responses ───────────────────────────────────────────────────

export interface CallInitiatedResponse {
  ok: true;
  requestId: string;
  plivoCallId: string;
  message: string;
}

export interface CallErrorResponse {
  ok: false;
  error: string;
  code: string;
}

// ── Failure Event (urgent, sent immediately for serious errors) ─────

export interface FailureEvent {
  schemaVersion: "1.0";
  eventId: string;
  requestId: string;
  plivoCallId?: string;
  contactId: string;
  clientId: string;
  category: FailureCategory;
  message: string;
  retryable: boolean;
  timestamp: string;
}

// ── Health Check ────────────────────────────────────────────────────

export interface HealthResponse {
  status: "healthy" | "degraded";
  uptime: number;
  activeCalls: number;
  metrics: {
    totalCalls: number;
    completedCalls: number;
    failedCalls: number;
    deliveryPending: number;
    providerFailures: Record<string, number>;
    avgResponseTimeMs: number | null;
  };
}
