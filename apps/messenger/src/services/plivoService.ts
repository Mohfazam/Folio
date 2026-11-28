import plivo from "plivo";
import { env } from "../config/env.js";

let plivoClient: plivo.Client | null = null;

function getPlivo(): plivo.Client {
  if (!plivoClient) {
    plivoClient = new plivo.Client(env.plivoAuthId, env.plivoAuthToken);
  }
  return plivoClient;
}

export interface SendSmsResult {
  providerMessageId: string;
  status: "queued" | "sent" | "failed";
  error?: string;
}

/**
 * Sends an SMS message using Plivo REST API.
 */
export async function sendPlivoSms(
  toNumber: string,
  body: string,
  fromNumber?: string
): Promise<SendSmsResult> {
  const client = getPlivo();
  const from = fromNumber || env.plivoPhoneNumber;

  try {
    const res = await client.messages.create(from, toNumber, body);
    const messageUuid =
      (res as any).messageUuid?.[0] ||
      (res as any).message_uuid?.[0] ||
      (res as any).apiId ||
      "";

    return {
      providerMessageId: messageUuid,
      status: "queued",
    };
  } catch (err: unknown) {
    console.error(`[messenger/plivo] Failed to send SMS to ${toNumber}:`, err);
    return {
      providerMessageId: "",
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
