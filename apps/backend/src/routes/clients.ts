import type { Request, Response } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { clients, users } from "@repo/db";

/**
 * Validates timezone identifier.
 */
function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates HH:MM or HH:MM:SS time format.
 */
function isValidTimeFormat(t: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(t.trim());
}

/**
 * GET /api/clients
 *
 * List all clients (admin/overview).
 */
export async function getClientsRoute(req: Request, res: Response) {
  try {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, req.clientId!))
      .orderBy(desc(clients.createdAt));

    const enriched = client
      ? [{
          ...client,
          creditsRemaining: Math.max(
            0,
            client.monthlyCreditsAllowance - client.creditsUsedThisCycle - client.creditsReservedThisCycle,
          ),
          callsRemainingToday: Math.max(0, client.maxCallsPerDay - client.callsMadeToday),
        }]
      : [];

    return res.json({ ok: true, clients: enriched, total: enriched.length });
  } catch (err: unknown) {
    console.error("[clients/get] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * GET /api/clients/:id
 *
 * Fetch client details, plan limits, credits used, and calling hours.
 */
export async function getClientByIdRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Client ID is required" });
    }

    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, req.clientId!))
      .limit(1);

    if (!client) {
      return res.status(404).json({ ok: false, error: `Client with ID ${id} not found` });
    }

    const creditsRemaining = Math.max(
      0,
      client.monthlyCreditsAllowance - client.creditsUsedThisCycle - client.creditsReservedThisCycle,
    );
    const callsRemainingToday = Math.max(0, client.maxCallsPerDay - client.callsMadeToday);

    return res.json({
      ok: true,
      client: {
        ...client,
        creditsRemaining,
        callsRemainingToday,
      },
    });
  } catch (err: unknown) {
    console.error("[clients/getById] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * PATCH /api/clients/:id
 *
 * Update client settings, including workspace calling hours and the workspace-scoped routingRules configuration.
 */
export async function updateClientRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Client ID is required" });
    }

    const {
      name,
      contactPersonName,
      contactEmail,
      contactPhone,
      callerIdNumber,
      callingHoursStart,
      callingHoursEnd,
      timezone,
      metadata,
      routingRules,
    } = req.body as Partial<{
      name: string;
      contactPersonName: string;
      contactEmail: string;
      contactPhone: string;
      callerIdNumber: string;
      callingHoursStart: string;
      callingHoursEnd: string;
      timezone: string;
      metadata: Record<string, any>;
      routingRules: Record<string, any>;
    }>;

    if (timezone && !isValidTimezone(timezone)) {
      return res.status(400).json({
        ok: false,
        error: `Invalid IANA timezone identifier: '${timezone}' (e.g. 'Asia/Kolkata', 'America/New_York')`,
      });
    }

    if (callingHoursStart && !isValidTimeFormat(callingHoursStart)) {
      return res.status(400).json({
        ok: false,
        error: `Invalid callingHoursStart format '${callingHoursStart}'. Expected 'HH:MM' or 'HH:MM:SS'`,
      });
    }

    if (callingHoursEnd && !isValidTimeFormat(callingHoursEnd)) {
      return res.status(400).json({
        ok: false,
        error: `Invalid callingHoursEnd format '${callingHoursEnd}'. Expected 'HH:MM' or 'HH:MM:SS'`,
      });
    }

    if (callingHoursStart !== undefined && callingHoursEnd !== undefined &&
        callingHoursStart.slice(0, 5) >= callingHoursEnd.slice(0, 5)) {
      return res.status(400).json({ ok: false, error: "Calling-hour end must be later than its start." });
    }

    if (callerIdNumber !== undefined && callerIdNumber !== null) {
      const [client] = await db
        .select({ contactPhone: clients.contactPhone, isPhoneVerified: clients.isPhoneVerified })
        .from(clients)
        .where(eq(clients.id, req.clientId!))
        .limit(1);
      if (!client?.isPhoneVerified || callerIdNumber !== client.contactPhone) {
        return res.status(400).json({
          ok: false,
          error: "Caller ID must match the workspace's verified phone number",
        });
      }
    }

    const updateData: Partial<typeof clients.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (name) updateData.name = name;
    if (contactPersonName !== undefined) updateData.contactPersonName = contactPersonName;
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone;
    if (callerIdNumber !== undefined) updateData.callerIdNumber = callerIdNumber;
    if (callingHoursStart !== undefined) updateData.callingHoursStart = callingHoursStart;
    if (callingHoursEnd !== undefined) updateData.callingHoursEnd = callingHoursEnd;
    if (timezone) updateData.timezone = timezone;

    if (routingRules !== undefined) {
      if (!routingRules || typeof routingRules !== "object" || Array.isArray(routingRules)) {
        return res.status(400).json({ ok: false, error: "routingRules must be an object." });
      }
      const callback = routingRules.callback && typeof routingRules.callback === "object" ? routingRules.callback : {};
      const highInterest = routingRules.highInterest && typeof routingRules.highInterest === "object" ? routingRules.highInterest : {};
      const humanRequested = routingRules.humanRequested && typeof routingRules.humanRequested === "object" ? routingRules.humanRequested : {};
      const noAnswer = routingRules.noAnswer && typeof routingRules.noAnswer === "object" ? routingRules.noAnswer : {};
      const memberIds = [callback.assignToUserId, highInterest.assignToUserId, humanRequested.assignToUserId]
        .filter((value): value is string => typeof value === "string" && value.length > 0);
      if (memberIds.length) {
        const found = await db.select({ id: users.id }).from(users)
          .where(and(eq(users.clientId, req.clientId!), inArray(users.id, [...new Set(memberIds)])));
        if (found.length !== new Set(memberIds).size) {
          return res.status(400).json({ ok: false, error: "Choose team members from this workspace only." });
        }
      }
      const dueInMinutes = Number(callback.dueInMinutes ?? 30);
      const retryAfterMinutes = Number(noAnswer.retryAfterMinutes ?? 1440);
      const maxRetries = Number(noAnswer.maxRetries ?? 2);
      if (!Number.isInteger(dueInMinutes) || dueInMinutes < 5 || dueInMinutes > 10080) {
        return res.status(400).json({ ok: false, error: "Callback delay must be between 5 minutes and 7 days." });
      }
      if (!Number.isInteger(retryAfterMinutes) || retryAfterMinutes < 15 || retryAfterMinutes > 10080) {
        return res.status(400).json({ ok: false, error: "Retry delay must be between 15 minutes and 7 days." });
      }
      if (!Number.isInteger(maxRetries) || maxRetries < 0 || maxRetries > 5) {
        return res.status(400).json({ ok: false, error: "Maximum retries must be between 0 and 5." });
      }
      const normalizedRules = {
        configured: true,
        callback: { enabled: callback.enabled !== false, assignToUserId: typeof callback.assignToUserId === "string" && callback.assignToUserId ? callback.assignToUserId : req.user?.id ?? null, dueInMinutes },
        highInterest: { enabled: highInterest.enabled !== false, assignToUserId: typeof highInterest.assignToUserId === "string" && highInterest.assignToUserId ? highInterest.assignToUserId : req.user?.id ?? null },
        humanRequested: { enabled: humanRequested.enabled !== false, assignToUserId: typeof humanRequested.assignToUserId === "string" && humanRequested.assignToUserId ? humanRequested.assignToUserId : req.user?.id ?? null },
        noAnswer: { enabled: noAnswer.enabled !== false, retryAfterMinutes, maxRetries },
        updatedAt: new Date().toISOString(),
      };
      updateData.metadata = sql`jsonb_set(COALESCE(${clients.metadata}, '{}'::jsonb) || ${JSON.stringify(metadata ?? {})}::jsonb, '{routingRules}', ${JSON.stringify(normalizedRules)}::jsonb, true)` as any;
    } else if (metadata !== undefined) {
      updateData.metadata = sql`COALESCE(${clients.metadata}, '{}'::jsonb) || ${JSON.stringify(metadata)}::jsonb` as any;
    }

    const [updated] = await db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, req.clientId!))
      .returning();

    if (!updated) {
      return res.status(404).json({ ok: false, error: `Client with ID ${id} not found` });
    }

    return res.json({
      ok: true,
      client: updated,
    });
  } catch (err: unknown) {
    console.error("[clients/patch] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
