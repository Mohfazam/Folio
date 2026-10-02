import type { Request, Response } from "express";
import { initiateOutboundCall } from "../providers/plivo/dial.js";
import { activeCallRegistry } from "../session/ActiveCallRegistry.js";

// Timestamp tracking to prevent rapid duplicate double-triggers (< 3 seconds)
let lastDialTimestamp = 0;
let lastDialPhone = "";

export async function dialRoute(req: Request, res: Response) {
  const params = { ...req.query, ...req.body };
  const phoneNumber = (params.phoneNumber as string) || (params.to as string) || undefined;
  const clientId = (params.clientId as string) || undefined;
  const contactId = (params.contactId as string) || undefined;
  const campaignId = (params.campaignId as string) || undefined;
  const instructions = (params.instructions as string) || undefined;
  const greetingText = (params.greetingText as string) || (params.greeting as string) || undefined;
  const language = (params.language as string) || undefined;

  // Support structured context passed directly or via business/campaign/contact keys
  const context =
    params.context ||
    (params.business || params.campaign || params.contact
      ? {
          business: params.business,
          campaign: params.campaign,
          contact: params.contact,
          additionalInstructions: instructions,
        }
      : undefined);

  const now = Date.now();
  if (phoneNumber && phoneNumber === lastDialPhone && now - lastDialTimestamp < 3000) {
    return res.status(429).json({
      ok: false,
      error: "Duplicate dial request debounced. Please wait a few seconds before trying again.",
      code: "DEBOUNCED",
    });
  }

  try {
    lastDialTimestamp = now;
    if (phoneNumber) lastDialPhone = phoneNumber;

    const result = await initiateOutboundCall({
      phoneNumber,
      clientId,
      contactId,
      campaignId,
      instructions,
      context,
      greetingText,
      language,
    });

    res.json(result);
  } catch (err: any) {
    console.error("[dialRoute] Dial error:", err?.message ?? err);

    if (err?.code === "CALL_ALREADY_ACTIVE") {
      return res.status(409).json({
        ok: false,
        error: err.message,
        code: "CALL_ALREADY_ACTIVE",
        existingCall: err.existingCall
          ? {
              requestId: err.existingCall.requestId,
              plivoCallId: err.existingCall.plivoCallId,
              phase: err.existingCall.phase,
              startedAt: err.existingCall.startedAt,
            }
          : undefined,
      });
    }

    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : "Dial failed",
    });
  }
}

export function activeCallsRoute(_req: Request, res: Response) {
  const active = activeCallRegistry.getAllActive().map((c) => ({
    requestId: c.requestId,
    plivoCallId: c.plivoCallId,
    phoneNumber: c.phoneNumber,
    clientId: c.clientId,
    contactId: c.contactId,
    phase: c.phase,
    startedAt: c.startedAt,
    lastActivityAt: c.lastActivityAt,
  }));

  res.json({
    ok: true,
    count: active.length,
    activeCalls: active,
  });
}
