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

type PurchasableTier = "growth" | "pro" | "scale";

const PLAN_DEFINITIONS: Record<
  string,
  { amountPaise: number; credits: number; name: string; tier?: PurchasableTier; envPlanKey?: string }
> = {
  growth: {
    amountPaise: 830000,
    credits: 12000,
    name: "Growth",
    tier: "growth",
    envPlanKey: "RAZORPAY_PLAN_ID_GROWTH",
  },
  pro: {
    amountPaise: 1250000,
    credits: 18000,
    name: "Pro",
    tier: "pro",
    envPlanKey: "RAZORPAY_PLAN_ID_PRO",
  },
  scale: {
    amountPaise: 1670000,
    credits: 24000,
    name: "Scale",
    tier: "scale",
    envPlanKey: "RAZORPAY_PLAN_ID_SCALE",
  },
  dev_test: { amountPaise: 100, credits: 1, name: "Dev Test" },
};

function getConfiguredRazorpayPlanId(planId: string): string | null {
  const def = PLAN_DEFINITIONS[planId];
  if (!def?.envPlanKey) return null;
  const val = process.env[def.envPlanKey]?.trim();
  return val && val.length > 0 ? val : null;
}

function isDevTestAllowed(req: Request): boolean {
  const host = (req.get("x-client-host") || req.get("x-forwarded-host") || req.get("host") || "").toLowerCase();
  return host.startsWith("localhost") || host.startsWith("127.0.0.1");
}

function computeNextMonthlyReset(from = new Date()): Date {
  const next = new Date(from);
  next.setMonth(next.getMonth() + 1);
  return next;
}

async function activateWorkspaceMonthlyPlan(
  clientId: string,
  planId: string,
  creditsGranted: number,
) {
  const def = PLAN_DEFINITIONS[planId];
  const now = new Date();
  const nextReset = computeNextMonthlyReset(now);

  if (def?.tier) {
    const [updatedClient] = await db
      .update(clients)
      .set({
        planTier: def.tier,
        status: "active",
        monthlyCreditsAllowance: sql`GREATEST(${clients.monthlyCreditsAllowance}, ${def.credits}) + GREATEST(0, (${clients.monthlyCreditsAllowance} - ${clients.creditsUsedThisCycle}))`,
        creditsUsedThisCycle: 0,
        planStartedAt: now,
        nextBillingResetAt: nextReset,
        updatedAt: now,
      })
      .where(eq(clients.id, clientId))
      .returning({
        creditsUsed: clients.creditsUsedThisCycle,
        allowance: clients.monthlyCreditsAllowance,
      });
    return updatedClient;
  }

  const [updatedClient] = await db
    .update(clients)
    .set({
      creditsUsedThisCycle: sql`greatest(0, ${clients.creditsUsedThisCycle} - ${creditsGranted})`,
      updatedAt: now,
    })
    .where(eq(clients.id, clientId))
    .returning({
      creditsUsed: clients.creditsUsedThisCycle,
      allowance: clients.monthlyCreditsAllowance,
    });
  return updatedClient;
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
    const razorpayPlanId = getConfiguredRazorpayPlanId(planId);

    // Idempotency: check if order/subscription already exists
    if (idempotencyKey) {
      const [existing] = await db
        .select()
        .from(billingOrders)
        .where(eq(billingOrders.idempotencyKey, idempotencyKey))
        .limit(1);
      if (existing?.razorpayOrderId) {
        const isSub = existing.razorpayOrderId.startsWith("sub_");
        return res.json({
          ok: true,
          ...(isSub
            ? { subscriptionId: existing.razorpayOrderId, orderId: existing.razorpayOrderId }
            : { orderId: existing.razorpayOrderId }),
          amount: existing.amountPaise,
          currency: existing.currency,
          keyId: env.razorpay.keyId,
          billingCycle: planId === "dev_test" ? "one_time" : "monthly",
          prefill: {
            name: billingDetails?.name as string,
            email: billingDetails?.email as string,
            contact: billingDetails?.contact as string,
          },
        });
      }
    }

    const commonNotes: Record<string, string> = {
      planId,
      clientId,
      billingCycle: planId === "dev_test" ? "one_time" : "monthly",
      workspaceName: (billingDetails?.companyName as string) || "",
      ...(billingDetails?.gstin ? { gstin: billingDetails.gstin as string } : {}),
    };

    // If a Razorpay Subscription Plan ID is configured (RAZORPAY_PLAN_ID_GROWTH/PRO/SCALE),
    // create a recurring monthly subscription; otherwise create a monthly checkout order.
    if (razorpayPlanId && planId !== "dev_test") {
      const subscription = await razorpay.subscriptions.create({
        plan_id: razorpayPlanId,
        total_count: 120,
        quantity: 1,
        customer_notify: 1,
        notes: commonNotes,
      });

      await db.insert(billingOrders).values({
        clientId,
        userId,
        planId,
        planName: plan.name,
        amountPaise: plan.amountPaise,
        creditsGranted: plan.credits,
        currency: "INR",
        status: "created",
        method: "razorpay_subscription",
        razorpayOrderId: subscription.id,
        idempotencyKey,
        billingDetails: billingDetails || {},
        notes: {
          companyName: billingDetails?.companyName,
          gstin: billingDetails?.gstin,
          razorpayPlanId,
          subscriptionId: subscription.id,
        },
      });

      return res.json({
        ok: true,
        subscriptionId: subscription.id,
        orderId: subscription.id,
        amount: plan.amountPaise,
        currency: "INR",
        keyId: env.razorpay.keyId,
        billingCycle: "monthly",
        prefill: {
          name: billingDetails?.name as string,
          email: billingDetails?.email as string,
          contact: billingDetails?.contact as string,
        },
      });
    }

    // Standard Razorpay order creation
    const rzpOrder = await razorpay.orders.create({
      amount: plan.amountPaise,
      currency: "INR",
      receipt: `foolioo_${planId}_${Date.now()}`,
      notes: commonNotes,
    });

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
      billingCycle: planId === "dev_test" ? "one_time" : "monthly",
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

function verifyRazorpayOrderSignature(orderId: string, paymentId: string, signature: string): boolean {
  const generated = crypto
    .createHmac("sha256", env.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  if (signature.length !== generated.length) return false;
  return crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(signature));
}

function verifyRazorpaySubscriptionSignature(
  subscriptionId: string,
  paymentId: string,
  signature: string,
): boolean {
  const generated = crypto
    .createHmac("sha256", env.razorpay.keySecret)
    .update(`${paymentId}|${subscriptionId}`)
    .digest("hex");
  if (signature.length !== generated.length) return false;
  return crypto.timingSafeEqual(Buffer.from(generated), Buffer.from(signature));
}

export async function verifyBillingPaymentRoute(req: Request, res: Response) {
  try {
    const {
      planId,
      razorpay_order_id,
      razorpay_subscription_id,
      razorpay_payment_id,
      razorpay_signature,
      razorpaySignature,
      idempotencyKey,
    } = req.body as {
      planId: string;
      razorpay_order_id?: string;
      razorpay_subscription_id?: string;
      razorpay_payment_id: string;
      razorpay_signature?: string;
      razorpaySignature?: string;
      idempotencyKey?: string;
    };
    const signature = razorpay_signature || razorpaySignature;
    const referenceEntityId = razorpay_subscription_id || razorpay_order_id || "";

    if (!planId || !PLAN_DEFINITIONS[planId]) {
      return res.status(400).json({ ok: false, error: "Invalid plan ID" });
    }
    if (planId === "dev_test" && !isDevTestAllowed(req)) {
      return res.status(403).json({ ok: false, error: "Dev test plan only available on localhost" });
    }
    if (!referenceEntityId || !razorpay_payment_id) {
      return res.status(400).json({ ok: false, error: "Missing Razorpay payment reference", verified: false });
    }

    const clientId = req.clientId!;
    const isSubscription =
      Boolean(razorpay_subscription_id) || referenceEntityId.startsWith("sub_");

    // Verify signature (Razorpay uses `payment_id|subscription_id` for subscriptions and `order_id|payment_id` for orders)
    const signatureValid =
      Boolean(signature) &&
      (isSubscription
        ? verifyRazorpaySubscriptionSignature(referenceEntityId, razorpay_payment_id, signature!)
        : verifyRazorpayOrderSignature(referenceEntityId, razorpay_payment_id, signature!));

    if (!signatureValid) {
      return res.status(400).json({ ok: false, error: "Invalid payment signature", verified: false });
    }

    // Idempotency: check if already verified
    const whereClause = idempotencyKey
      ? eq(billingOrders.idempotencyKey, idempotencyKey)
      : eq(billingOrders.razorpayOrderId, referenceEntityId);

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
    if (payment.status !== "captured" && payment.status !== "authorized") {
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

    const updatedClient = await activateWorkspaceMonthlyPlan(
      clientId,
      order.planId,
      order.creditsGranted,
    );

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
      orderId: referenceEntityId,
      method: payment.method || (isSubscription ? "subscription" : "razorpay"),
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

    const event = req.body as {
      event: string;
      payload: {
        payment?: { entity: any };
        subscription?: { entity: any };
      };
    };
    const payment = event.payload?.payment?.entity;
    const subscription = event.payload?.subscription?.entity;

    // Handle recurring subscription renewal charges (`subscription.charged`)
    if (event.event === "subscription.charged" && subscription?.id) {
      const subId: string = subscription.id;
      const [initialOrder] = await db
        .select()
        .from(billingOrders)
        .where(eq(billingOrders.razorpayOrderId, subId))
        .orderBy(desc(billingOrders.createdAt))
        .limit(1);

      if (!initialOrder) {
        console.warn(`[billing/webhook] Subscription not found in DB: ${subId}`);
        return res.json({ ok: true });
      }

      const renewalPaymentId: string | undefined = payment?.id;
      if (renewalPaymentId) {
        const [alreadyRecorded] = await db
          .select({ id: billingOrders.id })
          .from(billingOrders)
          .where(eq(billingOrders.razorpayPaymentId, renewalPaymentId))
          .limit(1);
        if (alreadyRecorded) {
          return res.json({ ok: true });
        }
      }

      if (initialOrder.status !== "paid") {
        await db
          .update(billingOrders)
          .set({
            status: "paid",
            ...(renewalPaymentId ? { razorpayPaymentId: renewalPaymentId } : {}),
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(billingOrders.id, initialOrder.id));
      } else if (renewalPaymentId) {
        await db.insert(billingOrders).values({
          clientId: initialOrder.clientId,
          userId: initialOrder.userId,
          planId: initialOrder.planId,
          planName: initialOrder.planName,
          amountPaise: initialOrder.amountPaise,
          creditsGranted: initialOrder.creditsGranted,
          currency: initialOrder.currency,
          status: "paid",
          method: "razorpay_subscription",
          razorpayPaymentId: renewalPaymentId,
          notes: { subscriptionId: subId, renewal: true },
          paidAt: new Date(),
        });
      }

      await activateWorkspaceMonthlyPlan(
        initialOrder.clientId,
        initialOrder.planId,
        initialOrder.creditsGranted,
      );
      console.log(`[billing/webhook] ✅ Monthly subscription renewed for client ${initialOrder.clientId}`);
      return res.json({ ok: true });
    }

    if (!payment || !payment.order_id) {
      return res.json({ ok: true });
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

        await activateWorkspaceMonthlyPlan(
          order.clientId,
          order.planId,
          order.creditsGranted,
        );

        console.log(`[billing/webhook] ✅ Monthly plan & credits activated: ${order.creditsGranted} for client ${order.clientId}`);
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
        orderId: o.razorpayOrderId || o.id,
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
