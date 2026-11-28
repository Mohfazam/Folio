import { env } from "./env.js";

interface BackendApiResponse<T = any> {
  ok: boolean;
  error?: string;
  [key: string]: any;
}

/**
 * Backend API Client for Messenger.
 * All database operations are forwarded to backend internal endpoints.
 */
export const backendApi = {
  async checkOptOut(clientId: string, phoneNumber: string, channel = "sms"): Promise<boolean> {
    const url = `${env.backendUrl.replace(/\/+$/, "")}/api/internal/messenger/opt-out/check?clientId=${encodeURIComponent(clientId)}&phoneNumber=${encodeURIComponent(phoneNumber)}&channel=${encodeURIComponent(channel)}`;
    try {
      const res = await fetch(url, {
        headers: { "x-worker-secret": env.backendWorkerSecret },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return false;
      const data: BackendApiResponse = await res.json();
      return Boolean(data.optedOut);
    } catch (err: unknown) {
      console.warn("[backendApi.checkOptOut] Failed:", err instanceof Error ? err.message : err);
      return false;
    }
  },

  async logMessage(record: {
    clientId: string;
    contactId?: string | null;
    callId?: string | null;
    channel?: string;
    direction?: string;
    status: string;
    type?: string;
    fromNumber: string;
    toNumber: string;
    body: string;
    providerMessageId?: string | null;
    errorMessage?: string | null;
    metadata?: Record<string, any> | null;
  }): Promise<string | null> {
    const url = `${env.backendUrl.replace(/\/+$/, "")}/api/internal/messenger/messages`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-worker-secret": env.backendWorkerSecret,
        },
        body: JSON.stringify(record),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return null;
      const data: BackendApiResponse = await res.json();
      return data.messageId || null;
    } catch (err: unknown) {
      console.warn("[backendApi.logMessage] Failed:", err instanceof Error ? err.message : err);
      return null;
    }
  },

  async recordDeliveryReceipt(providerMessageId: string, status: string, rawPayload: any): Promise<void> {
    const url = `${env.backendUrl.replace(/\/+$/, "")}/api/internal/messenger/delivery-receipt`;
    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-worker-secret": env.backendWorkerSecret,
        },
        body: JSON.stringify({ providerMessageId, status, rawPayload }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err: unknown) {
      console.warn("[backendApi.recordDeliveryReceipt] Failed:", err instanceof Error ? err.message : err);
    }
  },

  async recordInboundOptOut(fromNumber: string, reason?: string): Promise<void> {
    const url = `${env.backendUrl.replace(/\/+$/, "")}/api/internal/messenger/opt-out`;
    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-worker-secret": env.backendWorkerSecret,
        },
        body: JSON.stringify({ fromNumber, reason }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err: unknown) {
      console.warn("[backendApi.recordInboundOptOut] Failed:", err instanceof Error ? err.message : err);
    }
  },
};
