import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { clients } from "@repo/db";

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
      .where(eq(clients.id, id))
      .limit(1);

    if (!client) {
      return res.status(404).json({ ok: false, error: `Client with ID ${id} not found` });
    }

    const creditsRemaining = Math.max(0, client.monthlyCreditsAllowance - client.creditsUsedThisCycle);
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
 * Update client settings (callingHoursStart, callingHoursEnd, timezone, maxCallsPerDay, callerIdNumber, etc.).
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
      maxCallsPerDay,
      status,
    } = req.body as Partial<{
      name: string;
      contactPersonName: string;
      contactEmail: string;
      contactPhone: string;
      callerIdNumber: string;
      callingHoursStart: string;
      callingHoursEnd: string;
      timezone: string;
      maxCallsPerDay: number;
      status: any;
    }>;

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
    if (typeof maxCallsPerDay === "number" && maxCallsPerDay > 0) updateData.maxCallsPerDay = maxCallsPerDay;
    if (status) updateData.status = status;

    const [updated] = await db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, id))
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
