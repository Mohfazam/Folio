import { randomUUID } from "node:crypto";
import type {
  CallRequest,
  CallResult,
  CallStatus,
  FailureCategory,
  FailureEvent,
  TranscriptTurn,
  ProviderErrorRecord,
  RecordingMetadata,
} from "../types/callTypes.js";

/**
 * Per-call session state manager.
 *
 * One instance exists for each active call. It accumulates transcript turns,
 * provider errors, and timing data during the live call, then constructs the
 * final CallResult payload when the call ends.
 *
 * IMPORTANT: This state lives in-memory. If the process crashes before the
 * final result is delivered, the session state is lost. The file spool in
 * delivery/fileSpool.ts provides durability only for results that were built
 * but failed delivery.
 */
export class CallSessionState {
  // ── Identity ──────────────────────────────────────────────────
  readonly requestId: string;
  readonly contactId: string;
  readonly clientId: string;
  readonly phoneNumber: string;
  readonly language: string;
  readonly instructions?: string;

  // ── Plivo ─────────────────────────────────────────────────────
  plivoCallId = "";
  streamConnected = false;

  // ── Timestamps ────────────────────────────────────────────────
  readonly startedAt: Date;
  private endedAt: Date | null = null;

  // ── Terminal state ────────────────────────────────────────────
  private _status: CallStatus = "delivery_pending";
  private _failureCategory?: FailureCategory;
  private _failureReason?: string;
  private _retryable = true;
  private _terminated = false;

  // ── Transcript ────────────────────────────────────────────────
  private readonly _transcript: TranscriptTurn[] = [];

  // ── Provider errors ───────────────────────────────────────────
  private readonly _providerErrors: ProviderErrorRecord[] = [];

  // ── Recording ─────────────────────────────────────────────────
  private _recording?: RecordingMetadata;

  // ── Timing accumulators ───────────────────────────────────────
  private readonly _timings: {
    sttConnectMs?: number;
    greetingPlayedMs?: number;
    firstSentenceMs: number[];
    firstAudioMs: number[];
  } = { firstSentenceMs: [], firstAudioMs: [] };

  constructor(request: CallRequest) {
    this.requestId = request.requestId;
    this.contactId = request.contactId;
    this.clientId = request.clientId;
    this.phoneNumber = request.phoneNumber;
    this.language = request.language ?? "en-IN";
    this.instructions = request.instructions;
    this.startedAt = new Date();
  }

  get isTerminated(): boolean {
    return this._terminated;
  }

  get status(): CallStatus {
    return this._status;
  }

  /** Short log prefix for structured logging */
  get tag(): string {
    const id = this.plivoCallId || this.requestId;
    return `[call ${id.slice(0, 8)}]`;
  }

  // ── Transcript recording ──────────────────────────────────────

  addUserTurn(text: string, _language?: string): void {
    if (this._terminated) return;
    this._transcript.push({
      speaker: "user",
      text,
      timestamp: new Date().toISOString(),
      isComplete: true,
    });
  }

  addAssistantTurn(text: string, isComplete = true): void {
    if (this._terminated) return;
    this._transcript.push({
      speaker: "assistant",
      text,
      timestamp: new Date().toISOString(),
      isComplete,
    });
  }

  // ── Error recording ───────────────────────────────────────────

  recordError(
    stage: ProviderErrorRecord["stage"],
    category: FailureCategory,
    message: string,
    retryCount = 0,
    retryable = false
  ): void {
    this._providerErrors.push({
      stage,
      category,
      message: message.slice(0, 500), // cap length, never include secrets
      retryCount,
      timestamp: new Date().toISOString(),
      retryable,
    });
  }

  // ── Timing recording ─────────────────────────────────────────

  recordSttConnectTime(ms: number): void {
    this._timings.sttConnectMs = ms;
  }

  recordGreetingPlayed(ms: number): void {
    this._timings.greetingPlayedMs = ms;
  }

  recordFirstSentenceTime(ms: number): void {
    this._timings.firstSentenceMs.push(ms);
  }

  recordFirstAudioTime(ms: number): void {
    this._timings.firstAudioMs.push(ms);
  }

  // ── Recording ─────────────────────────────────────────────────

  setRecording(recording: RecordingMetadata): void {
    this._recording = recording;
  }

  // ── Terminal state transition ─────────────────────────────────

  /**
   * Mark the session as terminated with a final status.
   * Idempotent: subsequent calls are no-ops.
   * Every session must reach exactly one terminal state.
   */
  terminate(
    status: CallStatus,
    failureCategory?: FailureCategory,
    failureReason?: string,
    retryable?: boolean
  ): void {
    if (this._terminated) return;
    this._terminated = true;
    this._status = status;
    this._failureCategory = failureCategory;
    this._failureReason = failureReason;
    if (retryable !== undefined) this._retryable = retryable;
    this.endedAt = new Date();
  }

  // ── Auto-infer status from collected data ─────────────────────

  inferStatus(): CallStatus {
    if (this._providerErrors.some((e) => !e.retryable)) {
      const userTurns = this._transcript.filter((t) => t.speaker === "user");
      return userTurns.length > 0 ? "interrupted" : "failed";
    }
    if (this._providerErrors.length > 0) {
      const userTurns = this._transcript.filter((t) => t.speaker === "user");
      return userTurns.length > 0 ? "interrupted" : "failed";
    }
    const userTurns = this._transcript.filter((t) => t.speaker === "user");
    if (userTurns.length === 0) return "no_input";
    return "completed";
  }

  // ── Build final result payload ────────────────────────────────

  buildResult(): CallResult {
    if (!this._terminated) {
      this.terminate(this.inferStatus());
    }
    if (!this.endedAt) this.endedAt = new Date();

    const durationSeconds = Math.round(
      (this.endedAt.getTime() - this.startedAt.getTime()) / 1000
    );

    const avg = (arr: number[]) =>
      arr.length
        ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
        : undefined;

    return {
      schemaVersion: "1.0",
      deliveryId: `${this.requestId}:${this.plivoCallId || "no-plivo-id"}`,
      requestId: this.requestId,
      plivoCallId: this.plivoCallId,
      contactId: this.contactId,
      clientId: this.clientId,
      status: this._status,
      failureCategory: this._failureCategory,
      failureReason: this._failureReason,
      retryable: this._retryable,
      startedAt: this.startedAt.toISOString(),
      endedAt: this.endedAt.toISOString(),
      durationSeconds,
      transcript: this._transcript,
      recording: this._recording,
      providerErrors: this._providerErrors,
      timings: {
        sttConnectMs: this._timings.sttConnectMs,
        greetingPlayedMs: this._timings.greetingPlayedMs,
        avgFirstSentenceMs: avg(this._timings.firstSentenceMs),
        avgFirstAudioMs: avg(this._timings.firstAudioMs),
      },
    };
  }

  // ── Build urgent failure event ────────────────────────────────

  buildFailureEvent(
    category: FailureCategory,
    message: string,
    retryable: boolean
  ): FailureEvent {
    return {
      schemaVersion: "1.0",
      eventId: randomUUID(),
      requestId: this.requestId,
      plivoCallId: this.plivoCallId || undefined,
      contactId: this.contactId,
      clientId: this.clientId,
      category,
      message: message.slice(0, 500),
      retryable,
      timestamp: new Date().toISOString(),
    };
  }
}
