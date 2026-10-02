import { randomUUID } from "node:crypto";
import { plivoClient } from "./client.js";
import { env } from "../../config/env.js";
import { activeCallRegistry } from "../../session/ActiveCallRegistry.js";
import type { CallRequest } from "../../types/callTypes.js";

export interface InitiateCallParams {
  phoneNumber?: string;
  clientId?: string;
  contactId?: string;
  instructions?: string;
  language?: string;
}

export async function initiateOutboundCall(params?: InitiateCallParams) {
  const targetPhone = params?.phoneNumber || env.myTestPhoneNumber;
  const clientId = params?.clientId || "default-client";
  const contactId = params?.contactId || "test-contact";
  const instructions = params?.instructions;
  const language = params?.language || "en-IN";

  // Check concurrency lock: is there an active call ongoing or initiating to this phone?
  const check = activeCallRegistry.canInitiate(targetPhone);
  if (!check.allowed) {
    console.warn(`[plivo/dial] ⚠️ Blocked duplicate call to ${targetPhone}: ${check.reason}`);
    const err = new Error(check.reason ?? "A call is already in progress for this number");
    (err as any).code = "CALL_ALREADY_ACTIVE";
    (err as any).existingCall = check.existingCall;
    throw err;
  }

  const callRequest: CallRequest = {
    requestId: randomUUID(),
    contactId,
    clientId,
    phoneNumber: targetPhone,
    instructions,
    language,
  };

  // Register initiation in registry to lock the phone number immediately
  const activeRecord = activeCallRegistry.registerInitiation(callRequest);

  try {
    const answerUrl = `${env.publicUrl}/plivo-voice`;
    const hangupUrl = `${env.publicUrl}/plivo-hangup`;

    console.log(`[plivo/dial] 📞 Initiating call from ${env.plivoPhoneNumber} to ${targetPhone}...`);

    const plivoResponse = await plivoClient.calls.create(
      env.plivoPhoneNumber,
      targetPhone,
      answerUrl,
      {
        answer_method: "POST",
        hangup_url: hangupUrl,
        hangup_method: "POST",
        time_limit: 900, // 15 minutes max
      }
    );

    const requestUuid = Array.isArray(plivoResponse.requestUuid)
      ? plivoResponse.requestUuid[0]
      : plivoResponse.requestUuid;

    if (requestUuid) {
      activeCallRegistry.bindPlivoCall(requestUuid, requestUuid, targetPhone);
      activeRecord.requestUuid = requestUuid;
    }

    console.log(`[plivo/dial] ✅ Plivo call fired successfully:`, {
      message: plivoResponse.message,
      requestUuid,
      apiId: plivoResponse.apiId,
    });

    return {
      ok: true as const,
      requestId: callRequest.requestId,
      requestUuid,
      plivoCallId: requestUuid,
      message: plivoResponse.message,
      phoneNumber: targetPhone,
    };
  } catch (error: any) {
    console.error(`[plivo/dial] ❌ Plivo call creation failed:`, error?.message ?? error);
    activeCallRegistry.markEnded(callRequest.requestId, "failed", error?.message ?? "Plivo API error");
    throw error;
  }
}

// Retain dialTestCall for backwards compatibility
export async function dialTestCall() {
  return initiateOutboundCall();
}
