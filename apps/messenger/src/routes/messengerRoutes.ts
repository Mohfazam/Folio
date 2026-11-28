import { Router, type Request, type Response } from "express";
import { env } from "../config/env.js";
import { processPostCallMessage } from "../services/postCallMessengerService.js";
import { db, messages, messageDeliveryReceipts, messageOptOuts } from "@repo/db";
import { eq } from "drizzle-orm";

export const messengerRouter = Router();

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

    const [found] = await db
      .select({ id: messages.id, clientId: messages.clientId })
      .from(messages)
      .where(eq(messages.providerMessageId, messageUuid))
      .limit(1);

    if (found) {
      const now = new Date();
      const statusMap: Record<string, "delivered" | "failed" | "sent" | "undelivered"> = {
        delivered: "delivered",
        undelivered: "undelivered",
        failed: "failed",
        sent: "sent",
      };
      const dbStatus = statusMap[status?.toLowerCase()] || "sent";

      await db
        .update(messages)
        .set({
          status: dbStatus,
          providerStatus: status,
          ...(dbStatus === "delivered" ? { deliveredAt: now } : {}),
          ...(dbStatus === "failed" || dbStatus === "undelivered" ? { failedAt: now } : {}),
        })
        .where(eq(messages.id, found.id));

      await db.insert(messageDeliveryReceipts).values({
        messageId: found.id,
        provider: "plivo",
        rawStatus: status || "unknown",
        payload,
      });
    }

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
    const toNumber = payload.To || payload.to;
    const text = (payload.Text || payload.text || "").trim();

    if (fromNumber && text) {
      const isStop = /^(stop|unsubscribe|cancel|end|quit)$/i.test(text);

      if (isStop) {
        // Query recent message to match clientId
        const [recent] = await db
          .select({ clientId: messages.clientId })
          .from(messages)
          .where(eq(messages.toNumber, fromNumber))
          .limit(1);

        if (recent) {
          await db
            .insert(messageOptOuts)
            .values({
              clientId: recent.clientId,
              phoneNumber: fromNumber,
              channel: "sms",
              reason: `Inbound text: ${text}`,
            })
            .onConflictDoNothing();
          console.log(`[messenger] Recorded STOP opt-out for ${fromNumber}`);
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    console.error("[messenger/webhook] Inbound callback error:", err);
    return res.status(500).json({ ok: false, error: "Webhook processing error" });
  }
});
