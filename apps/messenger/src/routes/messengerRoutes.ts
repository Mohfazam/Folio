import { Router, type Request, type Response, type Router as RouterType } from "express";
import { env } from "../config/env.js";
import { backendApi } from "../config/backendClient.js";
import { processPostCallMessage } from "../services/postCallMessengerService.js";

export const messengerRouter: RouterType = Router();

// Internal authentication middleware
function requireInternalSecret(req: Request, res: Response, next: () => void) {
  const secret = req.headers["x-internal-secret"];
  if (!secret || secret !== env.internalSecret) {
    return res.status(401).json({ ok: false, error: "Unauthorized: Invalid internal secret" });
  }
  next();
}

/**
 * POST /api/messenger/post-call
 * Internal endpoint triggered by the backend when a call concludes with interest
 * or requested information.
 */
messengerRouter.post("/post-call", requireInternalSecret, async (req: Request, res: Response) => {
  try {
    const { callId, clientId, contactId, phoneNumber } = req.body;
    if (!callId || !clientId || !contactId || !phoneNumber) {
      return res.status(400).json({ ok: false, error: "Missing required call/contact identification" });
    }

    // Process asynchronously so we acknowledge backend immediately
    res.status(202).json({ ok: true, message: "Post-call message job accepted" });

    void processPostCallMessage(req.body).catch((err) => {
      console.error("[messenger/route] Error processing post-call message:", err);
    });
  } catch (err: unknown) {
    console.error("[messenger/route] Unexpected error in /post-call:", err);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

/**
 * POST /api/messenger/webhook/status
 * Plivo DLR (Delivery Receipt) status callback webhook.
 */
messengerRouter.post("/webhook/status", async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const messageUuid = payload.MessageUUID || payload.message_uuid;
    const status = payload.Status || payload.status;

    if (!messageUuid) {
      return res.status(400).json({ ok: false, error: "Missing MessageUUID in webhook" });
    }

    // Forward receipt persistence to backend internal API
    void backendApi.recordDeliveryReceipt(messageUuid, status, payload);

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    console.error("[messenger/webhook] Status callback error:", err);
    return res.status(500).json({ ok: false, error: "Webhook processing error" });
  }
});

/**
 * POST /api/messenger/webhook/inbound
 * Plivo inbound SMS callback webhook (for replies & STOP compliance).
 */
messengerRouter.post("/webhook/inbound", async (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const fromNumber = payload.From || payload.from;
    const text = (payload.Text || payload.text || "").trim();

    if (fromNumber && text) {
      const isStop = /^(stop|unsubscribe|cancel|end|quit)$/i.test(text);

      if (isStop) {
        // Forward opt-out recording to backend internal API
        void backendApi.recordInboundOptOut(fromNumber, `Inbound text: ${text}`);
        console.log(`[messenger] Forwarded STOP opt-out for ${fromNumber} to backend`);
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    console.error("[messenger/webhook] Inbound callback error:", err);
    return res.status(500).json({ ok: false, error: "Webhook processing error" });
  }
});
