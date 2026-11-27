import { env } from "../config/env.js";

export interface PostCallMessengerPayload {
  callId: string;
  clientId: string;
  contactId: string;
  contactName?: string | null;
  phoneNumber: string;
  callSummary?: string | null;
  interestLevel?: "high" | "medium" | "low" | "unknown" | null;
  sentiment?: "positive" | "neutral" | "negative" | null;
  infoRequested?: boolean;
  requestedInfo?: string | null;
  businessName?: string | null;
  businessWebsite?: string | null;
  fallbackLink?: string | null;
}

/**
 * Dispatches an asynchronous request to the Messenger service to compose
 * and send a contextual AI follow-up SMS.
 */
export async function triggerPostCallMessage(payload: PostCallMessengerPayload): Promise<void> {
  const targetUrl = `${env.messenger.serviceUrl.replace(/\/+$/, "")}/api/messenger/post-call`;
  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": env.messenger.internalSecret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000), // Non-blocking fast dispatch
    });
    if (!res.ok) {
      console.warn(`[triggerPostCallMessage] Messenger service returned ${res.status}: ${res.statusText}`);
    } else {
      console.log(`[triggerPostCallMessage] Dispatched post-call SMS trigger for call ${payload.callId}`);
    }
  } catch (err: unknown) {
    // Post-call message failure should never crash the call completion transaction
    console.warn(`[triggerPostCallMessage] Failed to reach messenger service at ${targetUrl}:`, err instanceof Error ? err.message : err);
  }
}
