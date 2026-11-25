import type { Request, Response } from "express";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { billingOrders, clients, users } from "@repo/db";
import Razorpay from "razorpay";
import crypto from "node:crypto";
import { env } from "../config/env.js";

const razorpay = new Razorpay({
  key_id: env.razorpay.keyId,
  key_secret: env.razorpay.keySecret,
});

const PLAN_DEFINITIONS: Record<string, { amountPaise: number; credits: number; name: string }> = {
  growth: { amountPaise: 830000, credits: 12000, name: "Growth" },
  pro: { amountPaise: 1250000, credits: 18000, name: "Pro" },
  scale: { amountPaise: 1670000, credits: 24000, name: "Scale" },
  dev_test: { amountPaise: 500, credits: 1, name: "Dev Test" },
};

function isDevTestAllowed(req: Request): boolean {
  const host = req.get("host") || "";
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

export async function createBillingOrderRoute(req: Request, res: Response) {
  try {
    const { planId, idempotencyKey, billingDetails } = req.body as {
      planId: string;
      idempotencyKey?: string;
      billingDetails?: Record<string, unknown>;
    };

    if (!planId || !PLAN_DEFINITIONS[planId]) {
      return res.status(400).json({ ok: false, error: "Invalid plan ID" });
    }
    if (planId === "dev_test" && !isDevTestAllowed(req)) {
      return res.status(403).json({ ok: false, error: "Dev test plan only available on localhost" });
    }

    const clientId = req.clientId!;
    const userId = req.user?.id ?? null;
    const plan = PLAN_DEFINITIONS[planId];

    // Idempotency: check if order already exists
    if (idempotencyKey) {
      const [existing] = await db
        .select()
        .from(billingOrders)
        .where(eq(billingOrders.idempotencyKey, idempotencyKey))
        .limit(1);
      if (existing?.razorpayOrderId) {
        const rzpOrder = await razorpay.orders.fetch(existing.razorpayOrderId);
        return res.json({
          ok: true,
          orderId: rzpOrder.id,
          amount: rzpOrder.amount,
          currency: rzpOrder.currency,
          keyId: env.razorpay.keyId,
          prefill: {
            name: billingDetails?.name as string,
            email: billingDetails?.email as string,
            contact: billingDetails?.contact as string,
          },
        });
      }
    }

    // Create Razorpay order
    const rzpOrder = await razorpay.orders.create({
      amount: plan.amountPaise,
      currency: "INR",
      receipt: `foolioo_${planId}_${Date.now()}`,
      notes: {
        planId,
        clientId,
        workspaceName: (billingDetails?.companyName as string) || "",
        ...(billingDetails?.gstin ? { gstin: billingDetails.gstin as string } : {}),
      },
    });

    // Store order in DB
    await db.insert(billingOrders).values({
      clientId,
      userId,
      planId,
      planName: plan.name,
      amountPaise: plan.amountPaise,
      creditsGranted: plan.credits,
      currency: "INR",
      status: "created",
      method: planId === "dev_test" ? "dev_test" : "razorpay",
      razorpayOrderId: rzpOrder.id,
      idempotencyKey,
      billingDetails: billingDetails || {},
      notes: {
        companyName: billingDetails?.companyName,
        gstin: billingDetails?.gstin,
      },
    });

    return res.json({
      ok: true,
      orderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      keyId: env.razorpay.keyId,
      prefill: {
        name: billingDetails?.name as string,
        email: billingDetails?.email as string,
        contact: billingDetails?.contact as string,
      },
    });
  } catch (err: unknown) {
    console.error("[billing/order] Error:", err);
    return res.status(500).json({ ok: false, error: "Could not create payment order" });
  }
}

function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const generated = crypto
    .createHmac("sha256", env.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  if (signature.length !== generated.length) return false;
  return crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(signature));
}

export async function verifyBillingPaymentRoute(req: Request, res: Response) {
  try {
    const {
      planId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      razorpaySignature,
      idempotencyKey,
    } = req.body as {
      planId: string;
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature?: string;
      razorpaySignature?: string;
      idempotencyKey?: string;
    };
    const signature = razorpay_signature || razorpaySignature;

    if (!planId || !PLAN_DEFINITIONS[planId]) {
      return res.status(400).json({ ok: false, error: "Invalid plan ID" });
    }
    if (planId === "dev_test" && !isDevTestAllowed(req)) {
      return res.status(403).json({ ok: false, error: "Dev test plan only available on localhost" });
    }

    const clientId = req.clientId!;

    // Verify signature
    if (!signature || !verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, signature)) {
      return res.status(400).json({ ok: false, error: "Invalid payment signature", verified: false });
    }

    // Idempotency: check if already verified
    const whereClause = idempotencyKey
      ? eq(billingOrders.idempotencyKey, idempotencyKey)
      : eq(billingOrders.razorpayOrderId, razorpay_order_id);

    const [order] = await db.select().from(billingOrders).where(whereClause).limit(1);
    if (!order) {
      return res.status(404).json({ ok: false, error: "Order not found", verified: false });
    }
    if (order.clientId !== clientId) {
      return res.status(403).json({ ok: false, error: "Order does not belong to this workspace", verified: false });
    }
    if (order.status === "paid") {
      return res.json({
        ok: true,
        verified: true,
        status: "paid",
        planId: order.planId,
        planName: order.planName,
        creditsGranted: order.creditsGranted,
        newCreditsBalance: null,
        paymentId: order.razorpayPaymentId!,
        orderId: order.razorpayOrderId!,
        method: order.method,
      });
    }

    // Fetch payment details from Razorpay
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    if (payment.status !== "captured") {
      await db
        .update(billingOrders)
        .set({ status: "failed", razorpayPaymentId: razorpay_payment_id, razorpaySignature: signature, updatedAt: new Date() })
        .where(eq(billingOrders.id, order.id));
      return res.status(400).json({ ok: false, error: `Payment status: ${payment.status}`, verified: false });
    }

    // Update order as paid
    await db
      .update(billingOrders)
      .set({
        status: "paid",
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: signature,
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(billingOrders.id, order.id));

    // Grant credits to client (reduce creditsUsedThisCycle to increase available balance)
    const [updatedClient] = await db
      .update(clients)
      .set({
        creditsUsedThisCycle: sql`greatest(0, ${clients.creditsUsedThisCycle} - ${order.creditsGranted})`,
        updatedAt: new Date(),
      })
      .where(eq(clients.id, clientId))
      .returning({ creditsUsed: clients.creditsUsedThisCycle, allowance: clients.monthlyCreditsAllowance });

    // Update user's last login
    if (order.userId) {
      await db
        .update(users)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, order.userId));
    }

    const newCreditsBalance = (updatedClient?.allowance ?? 0) - (updatedClient?.creditsUsed ?? 0);

    return res.json({
      ok: true,
      verified: true,
      status: "paid",
      planId: order.planId,
      planName: order.planName,
      creditsGranted: order.creditsGranted,
      newCreditsBalance,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      method: payment.method || "razorpay",
    });
  } catch (err: unknown) {
    console.error("[billing/verify] Error:", err);
    return res.status(500).json({ ok: false, error: "Payment verification failed" });
  }
}

export async function billingWebhookRoute(req: Request, res: Response) {
  try {
    const webhookSecret = env.razorpay.webhookSecret;
    if (!webhookSecret) {
      console.warn("[billing/webhook] RAZORPAY_WEBHOOK_SECRET not configured");
      return res.status(503).json({ ok: false, error: "Webhook not configured" });
    }

    const signature = req.get("x-razorpay-signature");
    const rawBody = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (!signature || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      console.warn("[billing/webhook] Invalid signature");
      return res.status(400).json({ ok: false, error: "Invalid webhook signature" });
    }

    const event = req.body as { event: string; payload: { payment: { entity: any } } };
    const payment = event.payload?.payment?.entity;

    if (!payment || !payment.order_id) {
      return res.json({ ok: true }); // Not a payment event we care about
    }

    const orderId = payment.order_id;

    const [order] = await db
      .select()
      .from(billingOrders)
      .where(eq(billingOrders.razorpayOrderId, orderId))
      .limit(1);

    if (!order) {
      console.warn(`[billing/webhook] Order not found for Razorpay order: ${orderId}`);
      return res.json({ ok: true });
    }

    if (event.event === "payment.captured") {
      if (order.status !== "paid") {
        await db
          .update(billingOrders)
          .set({
            status: "paid",
            razorpayPaymentId: payment.id,
            razorpaySignature: "",
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(billingOrders.id, order.id));

        await db
          .update(clients)
          .set({
            creditsUsedThisCycle: sql`greatest(0, ${clients.creditsUsedThisCycle} - ${order.creditsGranted})`,
            updatedAt: new Date(),
          })
          .where(eq(clients.id, order.clientId));

        console.log(`[billing/webhook] ✅ Credits granted: ${order.creditsGranted} for client ${order.clientId}`);
      }
    } else if (event.event === "payment.failed") {
      if (order.status !== "paid") {
        await db
          .update(billingOrders)
          .set({ status: "failed", razorpayPaymentId: payment.id, updatedAt: new Date() })
          .where(eq(billingOrders.id, order.id));
        console.log(`[billing/webhook] ❌ Payment failed for order ${orderId}`);
      }
    } else if (event.event === "payment.authorized") {
      // Payment authorized but not captured yet - could update status to "authorized"
      if (order.status === "created") {
        await db
          .update(billingOrders)
          .set({ status: "authorized", razorpayPaymentId: payment.id, updatedAt: new Date() })
          .where(eq(billingOrders.id, order.id));
        console.log(`[billing/webhook] 🔐 Payment authorized for order ${orderId}`);
      }
    }

    return res.json({ ok: true });
  } catch (err: unknown) {
    console.error("[billing/webhook] Error:", err);
    return res.status(500).json({ ok: false, error: "Webhook processing failed" });
  }
}

export async function getBillingStatusRoute(req: Request, res: Response) {
  try {
    const clientId = req.clientId!;

    const [client] = await db
      .select({
        planTier: clients.planTier,
        monthlyCreditsAllowance: clients.monthlyCreditsAllowance,
        creditsUsedThisCycle: clients.creditsUsedThisCycle,
        status: clients.status,
      })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return res.status(404).json({ ok: false, error: "Workspace not found" });
    }

    const orders = await db
      .select()
      .from(billingOrders)
      .where(and(eq(billingOrders.clientId, clientId), eq(billingOrders.status, "paid")))
      .orderBy(desc(billingOrders.createdAt));

    return res.json({
      ok: true,
      currentPlanTier: client.planTier,
      creditsAllowance: client.monthlyCreditsAllowance,
      creditsUsed: client.creditsUsedThisCycle,
      creditsBalance: client.monthlyCreditsAllowance - client.creditsUsedThisCycle,
      status: client.status,
      lastPurchasedPlanId: orders[0]?.planId ?? null,
      lastPurchasedAt: orders[0]?.createdAt?.toISOString() ?? null,
      orders: orders.map((o) => ({
        orderId: o.razorpayOrderId,
        paymentId: o.razorpayPaymentId,
        planId: o.planId,
        planName: o.planName,
        amountInr: o.amountPaise / 100,
        creditsGranted: o.creditsGranted,
        status: o.status,
        method: o.method,
        createdAt: o.createdAt?.toISOString(),
      })),
    });
  } catch (err: unknown) {
    console.error("[billing/status] Error:", err);
    return res.status(500).json({ ok: false, error: "Could not load billing status" });
  }
}