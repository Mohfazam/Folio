import { Router, type Request, type Response, type Router as RouterType } from "express";
import { requireWorkerSecret } from "../middleware/auth.js";
import { db } from "../config/db.js";
import { messages, messageDeliveryReceipts, messageOptOuts } from "@repo/db";
import { and, eq } from "drizzle-orm";

export const messengerInternalRouter: RouterType = Router();

// Secure all endpoints with worker/internal secret
messengerInternalRouter.use(requireWorkerSecret);

/**
 * GET /api/internal/messenger/opt-out/check
 * Query parameter: ?clientId=...&phoneNumber=...&channel=sms
 */
messengerInternalRouter.get("/opt-out/check", async (req: Request, res: Response) => {
  try {
    const { clientId, phoneNumber, channel = "sms" } = req.query as {
      clientId?: string;
      phoneNumber?: string;
      channel?: "sms" | "whatsapp";
    };

    if (!clientId || !phoneNumber) {
      return res.status(400).json({ ok: false, error: "Missing clientId or phoneNumber" });
    }

    const [optedOut] = await db
      .select({ id: messageOptOuts.id })
      .from(messageOptOuts)
      .where(
        and(
          eq(messageOptOuts.clientId, clientId),
          eq(messageOptOuts.phoneNumber, phoneNumber),
          eq(messageOptOuts.channel, channel)
        )
      )
      .limit(1);

    return res.json({ ok: true, optedOut: Boolean(optedOut) });
  } catch (err: unknown) {
    console.error("[messenger-internal] opt-out check error:", err);
    return res.status(500).json({ ok: false, error: "Internal database error" });
  }
});

/**
 * POST /api/internal/messenger/messages
 * Logs an outbound message record into the database.
 */
messengerInternalRouter.post("/messages", async (req: Request, res: Response) => {
  try {
    const {
      clientId,
      contactId,
      callId,
      channel = "sms",
      direction = "outbound",
      status = "queued",
      type = "post_call_followup",
      fromNumber,
      toNumber,
      body,
      providerMessageId,
      errorMessage,
      metadata,
    } = req.body;

    if (!clientId || !fromNumber || !toNumber || !body) {
      return res.status(400).json({ ok: false, error: "Missing required message parameters" });
    }

    const [inserted] = await db
      .insert(messages)
      .values({
        clientId,
        contactId: contactId || null,
        callId: callId || null,
        channel,
        direction,
        status,
        type,
        fromNumber,
        toNumber,
        body,
        providerMessageId: providerMessageId || null,
        errorMessage: errorMessage || null,
        metadata: metadata || null,
      })
      .returning({ id: messages.id });

    return res.status(201).json({ ok: true, messageId: inserted?.id });
  } catch (err: unknown) {
    console.error("[messenger-internal] create message error:", err);
    return res.status(500).json({ ok: false, error: "Failed to persist message record" });
  }
});

/**
 * POST /api/internal/messenger/delivery-receipt
 * Records provider delivery status callbacks into database.
 */
messengerInternalRouter.post("/delivery-receipt", async (req: Request, res: Response) => {
  try {
    const { providerMessageId, status, rawPayload } = req.body;
    if (!providerMessageId) {
      return res.status(400).json({ ok: false, error: "Missing providerMessageId" });
    }

    const [found] = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.providerMessageId, providerMessageId))
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
        payload: rawPayload || {},
      });
    }

    return res.json({ ok: true, matched: Boolean(found) });
  } catch (err: unknown) {
    console.error("[messenger-internal] delivery receipt error:", err);
    return res.status(500).json({ ok: false, error: "Failed to record delivery receipt" });
  }
});

/**
 * POST /api/internal/messenger/opt-out
 * Records an inbound opt-out (e.g. STOP) into database.
 */
messengerInternalRouter.post("/opt-out", async (req: Request, res: Response) => {
  try {
    const { fromNumber, reason } = req.body;
    if (!fromNumber) {
      return res.status(400).json({ ok: false, error: "Missing fromNumber" });
    }

    // Match client from most recent message sent to this number
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
          reason: reason || "STOP request",
        })
        .onConflictDoNothing();
      return res.json({ ok: true, optedOut: true });
    }

    return res.json({ ok: true, optedOut: false, reason: "No matching workspace found for recipient number" });
  } catch (err: unknown) {
    console.error("[messenger-internal] opt-out recording error:", err);
    return res.status(500).json({ ok: false, error: "Failed to record opt-out" });
  }
});
