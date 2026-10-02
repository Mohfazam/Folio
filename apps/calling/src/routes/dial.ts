import type { Request, Response } from "express";
import { initiateOutboundCall } from "../providers/plivo/dial.js";
import { activeCallRegistry } from "../session/ActiveCallRegistry.js";
import { metricsCollector } from "../monitoring/metricsCollector.js";

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
  const callbackUrl = (params.callbackUrl as string) || (params.webhookUrl as string) || undefined;
  const recordCall = params.recordCall !== undefined ? Boolean(params.recordCall) : false;
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

  // ── Input validation ────────────────────────────────────────────
  // In production, phoneNumber must be explicitly provided. Silently falling
  // back to MY_TEST_PHONE_NUMBER could cause accidental calls to the dev's phone.
  const isProduction = process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT;
  if (!phoneNumber && isProduction) {
    return res.status(400).json({
      ok: false,
      error: "Missing required field: phoneNumber. You must provide a destination phone number.",
      code: "MISSING_PHONE_NUMBER",
    });
  }

  // Basic E.164 validation: must be digits, optionally with leading +
  const targetPhone = phoneNumber || (params.to as string) || undefined;
  if (targetPhone && !/^\+?\d{7,15}$/.test(targetPhone.replace(/[\s\-()]/g, ""))) {
    return res.status(400).json({
      ok: false,
      error: `Invalid phone number format: "${targetPhone}". Expected E.164 format (e.g., +91XXXXXXXXXX).`,
      code: "INVALID_PHONE_NUMBER",
    });
  }

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
    metricsCollector.recordCallInitiated(phoneNumber);

    const result = await initiateOutboundCall({
      phoneNumber,
      clientId,
      contactId,
      campaignId,
      instructions,
      context,
      greetingText,
      callbackUrl,
      recordCall,
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

    metricsCollector.recordCallEnded("failed", 0, err?.message);

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
