import { randomUUID } from "node:crypto";
import type { CallRequest, CallResult, CallStatus } from "../types/callTypes.js";
import { CallSessionState } from "./CallSessionState.js";

export type CallLifecyclePhase = "initiating" | "ringing" | "in-progress" | "ended";

export interface ActiveCallRecord {
  requestId: string;
  contactId: string;
  clientId: string;
  phoneNumber: string;
  requestUuid?: string;
  plivoCallId?: string;
  phase: CallLifecyclePhase;
  startedAt: Date;
  lastActivityAt: Date;
  sessionState: CallSessionState;
}

/**
 * Registry to manage in-flight calls and prevent duplicate simultaneous calls
 * to the same recipient phone number or client.
 */
class ActiveCallRegistry {
  private readonly callsByPhone = new Map<string, ActiveCallRecord>();
  private readonly callsByPlivoId = new Map<string, ActiveCallRecord>();
  private readonly callsByRequestId = new Map<string, ActiveCallRecord>();

  // Normalizes phone numbers (removes spaces, dashes, parentheses)
  private normalizePhone(phone: string): string {
    const cleaned = phone.replace(/[\s\-()]/g, "");
    // Ensure leading + if missing
    return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
  }

  /**
   * Check whether a new call to this phone number is permitted.
   * Rejects if a call is currently initiating, ringing, or in progress.
   */
  canInitiate(phoneNumber: string): { allowed: boolean; reason?: string; existingCall?: ActiveCallRecord } {
    this.cleanupStaleCalls();
    const normalized = this.normalizePhone(phoneNumber);
    const existing = this.callsByPhone.get(normalized);

    if (existing && existing.phase !== "ended") {
      return {
        allowed: false,
        reason: `A call is already ${existing.phase} for phone number ${normalized} (plivoId: ${existing.plivoCallId ?? existing.requestUuid ?? "pending"})`,
        existingCall: existing,
      };
    }

    return { allowed: true };
  }

  /**
   * Acquire a lock and register a newly initiated call.
   */
  registerInitiation(request: CallRequest, requestUuid?: string): ActiveCallRecord {
    const normalized = this.normalizePhone(request.phoneNumber);
    const sessionState = new CallSessionState(request);

    const record: ActiveCallRecord = {
      requestId: request.requestId,
      contactId: request.contactId,
      clientId: request.clientId,
      phoneNumber: normalized,
      requestUuid,
      phase: "initiating",
      startedAt: new Date(),
      lastActivityAt: new Date(),
      sessionState,
    };

    this.callsByPhone.set(normalized, record);
    this.callsByRequestId.set(request.requestId, record);
    if (requestUuid) {
      this.callsByPlivoId.set(requestUuid, record);
    }

    console.log(`[registry] 🔒 Locked phone ${normalized} for call ${request.requestId} (phase: initiating)`);
    return record;
  }

  /**
   * Updates Plivo identifiers when Plivo API returns or when answer_url webhook triggers.
   */
  bindPlivoCall(plivoCallId: string, requestUuid?: string, phoneNumber?: string): ActiveCallRecord | undefined {
    let record: ActiveCallRecord | undefined;

    if (requestUuid) {
      record = this.callsByPlivoId.get(requestUuid);
    }

    if (!record && phoneNumber) {
      const normalized = this.normalizePhone(phoneNumber);
      record = this.callsByPhone.get(normalized);
    }

    if (!record) {
      record = this.callsByPlivoId.get(plivoCallId);
    }

    if (!record && phoneNumber) {
      // If no record exists yet (e.g. inbound call or external trigger), create one
      const req: CallRequest = {
        requestId: randomUUID(),
        contactId: "unknown",
        clientId: "default",
        phoneNumber,
      };
      record = this.registerInitiation(req, requestUuid);
    }

    if (record) {
      record.plivoCallId = plivoCallId;
      record.lastActivityAt = new Date();
      record.sessionState.plivoCallId = plivoCallId;
      this.callsByPlivoId.set(plivoCallId, record);
      if (requestUuid) {
        this.callsByPlivoId.set(requestUuid, record);
      }
    }

    return record;
  }

  /**
   * Mark that the call has been answered and media stream is starting.
   */
  markInProgress(identifier: string): ActiveCallRecord | undefined {
    const record = this.get(identifier);
    if (record) {
      record.phase = "in-progress";
      record.lastActivityAt = new Date();
      record.sessionState.streamConnected = true;
      console.log(`[registry] 🟢 Call ${record.plivoCallId ?? record.requestId} to ${record.phoneNumber} is now IN-PROGRESS`);
    }
    return record;
  }

  /**
   * Mark call as ended and release concurrency lock for that phone number.
   */
  markEnded(identifier: string, status?: CallStatus, reason?: string): ActiveCallRecord | undefined {
    const record = this.get(identifier);
    if (!record) return undefined;

    record.phase = "ended";
    record.lastActivityAt = new Date();
    if (status) {
      record.sessionState.terminate(status, undefined, reason);
    }

    // Release lock for phone number
    const currentForPhone = this.callsByPhone.get(record.phoneNumber);
    if (currentForPhone?.requestId === record.requestId) {
      this.callsByPhone.delete(record.phoneNumber);
      console.log(`[registry] 🔓 Unlocked phone ${record.phoneNumber} (call ended: ${status ?? "completed"})`);
    }

    // Keep Plivo mapping temporarily for query, but clear after 5 minutes
    setTimeout(() => {
      if (record.plivoCallId) this.callsByPlivoId.delete(record.plivoCallId);
      if (record.requestUuid) this.callsByPlivoId.delete(record.requestUuid);
      this.callsByRequestId.delete(record.requestId);
    }, 5 * 60 * 1000).unref();

    return record;
  }

  /**
   * Find call by plivoCallId, requestUuid, requestId, or phone number.
   */
  get(identifier: string): ActiveCallRecord | undefined {
    if (this.callsByPlivoId.has(identifier)) return this.callsByPlivoId.get(identifier);
    if (this.callsByRequestId.has(identifier)) return this.callsByRequestId.get(identifier);
    const normalized = this.normalizePhone(identifier);
    return this.callsByPhone.get(normalized);
  }

  getAllActive(): ActiveCallRecord[] {
    this.cleanupStaleCalls();
    return Array.from(this.callsByPhone.values()).filter((c) => c.phase !== "ended");
  }

  /**
   * Safety sweep: automatically expires calls that remained in "initiating"
   * or inactive for too long without connecting.
   */
  private cleanupStaleCalls() {
    const now = Date.now();
    for (const [phone, record] of this.callsByPhone.entries()) {
      const elapsed = now - record.startedAt.getTime();
      // If initiating for more than 90 seconds without progress, assume call failed to connect
      if (record.phase === "initiating" && elapsed > 90_000) {
        console.warn(`[registry] ⚠️ Expiring stale initiating call ${record.requestId} for ${phone}`);
        this.markEnded(record.requestId, "no_answer", "Initiation timed out before answer");
      }
      // If call is older than 2 hours, clean it up
      if (elapsed > 2 * 60 * 60 * 1000) {
        this.markEnded(record.requestId, "failed", "Call exceeded max allowed lifetime");
      }
    }
  }
}

export const activeCallRegistry = new ActiveCallRegistry();
