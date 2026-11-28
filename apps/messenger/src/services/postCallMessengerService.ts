import { env } from "../config/env.js";
import { backendApi } from "../config/backendClient.js";
import { composePostCallMessage } from "./aiComposer.js";
import { sendPlivoSms } from "./plivoService.js";

export interface PostCallMessageRequest {
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
 * Orchestrates compliance checks, AI message synthesis, Plivo dispatch,
 * and database audit record persistence via backend internal API.
 */
export async function processPostCallMessage(
  payload: PostCallMessageRequest
): Promise<{ ok: boolean; messageId?: string; reason?: string }> {
  // 1. Compliance: Check if recipient has opted out of SMS via backend
  const optedOut = await backendApi.checkOptOut(payload.clientId, payload.phoneNumber, "sms");
  if (optedOut) {
    console.log(`[messenger] Contact ${payload.phoneNumber} is opted out. Suppressing SMS.`);
    return { ok: false, reason: "Recipient has opted out of SMS communications." };
  }

  // 2. Compose AI customized SMS
  const smsBody = await composePostCallMessage({
    contactName: payload.contactName,
    businessName: payload.businessName,
    callSummary: payload.callSummary,
    interestLevel: payload.interestLevel,
    sentiment: payload.sentiment,
    infoRequested: payload.infoRequested,
    requestedInfo: payload.requestedInfo,
    fallbackLink: payload.businessWebsite || payload.fallbackLink,
  });

  // 3. Dispatch SMS via Plivo
  const sendResult = await sendPlivoSms(payload.phoneNumber, smsBody, env.plivoPhoneNumber);

  // 4. Save record to messages table via backend API
  const messageId = await backendApi.logMessage({
    clientId: payload.clientId,
    contactId: payload.contactId,
    callId: payload.callId,
    channel: "sms",
    direction: "outbound",
    status: sendResult.status === "failed" ? "failed" : "queued",
    type: "post_call_followup",
    fromNumber: env.plivoPhoneNumber,
    toNumber: payload.phoneNumber,
    body: smsBody,
    providerMessageId: sendResult.providerMessageId || null,
    errorMessage: sendResult.error || null,
    metadata: {
      generatedBy: "gemini-flash-lite",
      callSummary: payload.callSummary,
      interestLevel: payload.interestLevel,
      requestedInfo: payload.requestedInfo,
    },
  });

  if (messageId) {
    console.log(`[messenger] Logged post-call SMS (id=${messageId}) for call=${payload.callId}`);
    return { ok: true, messageId };
  }

  return { ok: true, reason: "SMS sent, backend logged status." };
}
