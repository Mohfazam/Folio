import type { Request, Response } from "express";
import { eq, desc } from "drizzle-orm";
import { db } from "../config/db.js";
import { clients } from "@repo/db";

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
 * Update client settings (callingHoursStart, callingHoursEnd, timezone, maxCallsPerDay, callerIdNumber, metadata, etc.).
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
    if (metadata !== undefined) updateData.metadata = metadata;

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
