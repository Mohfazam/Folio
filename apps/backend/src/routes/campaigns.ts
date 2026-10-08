import type { Request, Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { campaigns, calls } from "@repo/db";

const VALID_TYPES = [
  "outreach_sales",
  "follow_up",
  "reminder",
  "reactivation",
  "feedback_survey",
  "announcement",
] as const;
type CampaignType = (typeof VALID_TYPES)[number];

const VALID_STATUSES = ["draft", "active", "paused", "completed"] as const;
type CampaignStatus = (typeof VALID_STATUSES)[number];

/**
 * GET /api/campaigns
 *
 * List campaigns for a client with call volume & stats aggregation.
 */
export async function getCampaignsRoute(req: Request, res: Response) {
  try {
    const { status, type } = req.query as {
      status?: string;
      type?: string;
    };
    const clientId = req.clientId!;

    const conditions = [eq(campaigns.clientId, clientId)];

    if (status && VALID_STATUSES.includes(status as CampaignStatus)) {
      conditions.push(eq(campaigns.status, status as CampaignStatus));
    }

    if (type && VALID_TYPES.includes(type as CampaignType)) {
      conditions.push(eq(campaigns.type, type as CampaignType));
    }

    const campaignList = await db
      .select({
        id: campaigns.id,
        clientId: campaigns.clientId,
        name: campaigns.name,
        type: campaigns.type,
        status: campaigns.status,
        primaryObjective: campaigns.primaryObjective,
        callOpeningHook: campaigns.callOpeningHook,
        keyTalkingPoints: campaigns.keyTalkingPoints,
        objectionHandlers: campaigns.objectionHandlers,
        callToAction: campaigns.callToAction,
        fallbackOffer: campaigns.fallbackOffer,
        targetAudience: campaigns.targetAudience,
        language: campaigns.language,
        maxDurationSeconds: campaigns.maxDurationSeconds,
        metadata: campaigns.metadata,
        createdAt: campaigns.createdAt,
        updatedAt: campaigns.updatedAt,
      })
      .from(campaigns)
      .where(and(...conditions))
      .orderBy(desc(campaigns.createdAt));

    // Calculate aggregated stats for each campaign
    const enrichedCampaigns = await Promise.all(
      campaignList.map(async (c) => {
        const [stats] = await db
          .select({
            totalCalls: sql<number>`count(*)::int`,
            connectedCalls: sql<number>`count(case when ${calls.outcome} = 'connected' then 1 end)::int`,
            highInterestCalls: sql<number>`count(case when ${calls.interestLevel} = 'high' then 1 end)::int`,
          })
          .from(calls)
          .where(and(eq(calls.campaignId, c.id), eq(calls.clientId, clientId)));

        return {
          ...c,
          stats: {
            totalCalls: stats?.totalCalls ?? 0,
            connectedCalls: stats?.connectedCalls ?? 0,
            highInterestCalls: stats?.highInterestCalls ?? 0,
          },
        };
      })
    );

    return res.json({
      ok: true,
      campaigns: enrichedCampaigns,
      total: enrichedCampaigns.length,
    });
  } catch (err: unknown) {
    console.error("[campaigns/get] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * GET /api/campaigns/:id
 *
 * Detailed single campaign.
 */
export async function getCampaignByIdRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Campaign ID is required" });
    }

    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.clientId, req.clientId!)))
      .limit(1);

    if (!campaign) {
      return res.status(404).json({ ok: false, error: `Campaign ${id} not found` });
    }

    const [stats] = await db
      .select({
        totalCalls: sql<number>`count(*)::int`,
        connectedCalls: sql<number>`count(case when ${calls.outcome} = 'connected' then 1 end)::int`,
        highInterestCalls: sql<number>`count(case when ${calls.interestLevel} = 'high' then 1 end)::int`,
        followUpsRequested: sql<number>`count(case when ${calls.followUpRequested} = true then 1 end)::int`,
      })
      .from(calls)
      .where(and(eq(calls.campaignId, id), eq(calls.clientId, req.clientId!)));

    return res.json({
      ok: true,
      campaign: {
        ...campaign,
        stats: {
          totalCalls: stats?.totalCalls ?? 0,
          connectedCalls: stats?.connectedCalls ?? 0,
          highInterestCalls: stats?.highInterestCalls ?? 0,
          followUpsRequested: stats?.followUpsRequested ?? 0,
        },
      },
    });
  } catch (err: unknown) {
    console.error("[campaigns/getById] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * POST /api/campaigns
 *
 * Create a new campaign.
 */
export async function createCampaignRoute(req: Request, res: Response) {
  try {
    const {
      name,
      type = "outreach_sales",
      primaryObjective,
      callOpeningHook,
      keyTalkingPoints = [],
      objectionHandlers = [],
      callToAction,
      fallbackOffer,
      targetAudience,
      language = "en-IN",
      maxDurationSeconds = 300,
      metadata = {},
    } = req.body as {
      name?: string;
      type?: string;
      primaryObjective?: string;
      callOpeningHook?: string;
      keyTalkingPoints?: string[];
      objectionHandlers?: any[];
      callToAction?: string;
      fallbackOffer?: string;
      targetAudience?: string;
      language?: string;
      maxDurationSeconds?: number;
      metadata?: Record<string, any>;
    };

    if (!name || !primaryObjective || !callOpeningHook || !callToAction) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: name, primaryObjective, callOpeningHook, and callToAction are required",
      });
    }

    if (!VALID_TYPES.includes(type as CampaignType)) {
      return res.status(400).json({ ok: false, error: `Invalid campaign type '${type}'` });
    }
    if (!Number.isInteger(maxDurationSeconds) || maxDurationSeconds < 30 || maxDurationSeconds > 900) {
      return res.status(400).json({ ok: false, error: "maxDurationSeconds must be between 30 and 900" });
    }

    const [newCampaign] = await db
      .insert(campaigns)
      .values({
        clientId: req.clientId!,
        name,
        type: type as CampaignType,
        status: "draft",
        primaryObjective,
        callOpeningHook,
        keyTalkingPoints,
        objectionHandlers,
        callToAction,
        fallbackOffer: fallbackOffer ?? null,
        targetAudience: targetAudience ?? null,
        language,
        maxDurationSeconds,
        metadata,
      })
      .returning();

    return res.status(201).json({
      ok: true,
      campaign: newCampaign,
    });
  } catch (err: unknown) {
    console.error("[campaigns/create] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * PATCH /api/campaigns/:id
 *
 * Update campaign details.
 */
export async function updateCampaignRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Campaign ID is required" });
    }

    const {
      name,
      type,
      status,
      primaryObjective,
      callOpeningHook,
      keyTalkingPoints,
      objectionHandlers,
      callToAction,
      fallbackOffer,
      targetAudience,
      language,
      maxDurationSeconds,
      metadata,
    } = req.body as Partial<{
      name: string;
      type: CampaignType;
      status: CampaignStatus;
      primaryObjective: string;
      callOpeningHook: string;
      keyTalkingPoints: string[];
      objectionHandlers: any[];
      callToAction: string;
      fallbackOffer: string;
      targetAudience: string;
      language: string;
      maxDurationSeconds: number;
      metadata: Record<string, any>;
    }>;

    const updateData: Partial<typeof campaigns.$inferInsert> = {
      updatedAt: new Date(),
    };

    const [existing] = await db
      .select({ status: campaigns.status })
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.clientId, req.clientId!)))
      .limit(1);
    if (!existing) {
      return res.status(404).json({ ok: false, error: `Campaign ${id} not found` });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ ok: false, error: `Invalid campaign status '${status}'` });
    }
    if (type && !VALID_TYPES.includes(type)) {
      return res.status(400).json({ ok: false, error: `Invalid campaign type '${type}'` });
    }
    const allowedTransitions: Record<CampaignStatus, CampaignStatus[]> = {
      draft: ["active", "paused"],
      active: ["paused", "completed"],
      paused: ["active", "completed"],
      completed: [],
    };
    if (status && status !== existing.status && !allowedTransitions[existing.status].includes(status)) {
      return res.status(409).json({
        ok: false,
        error: `Campaign cannot transition from ${existing.status} to ${status}`,
      });
    }
    if (name) updateData.name = name;
    if (type) updateData.type = type;
    if (status) updateData.status = status;
    if (primaryObjective) updateData.primaryObjective = primaryObjective;
    if (callOpeningHook) updateData.callOpeningHook = callOpeningHook;
    if (keyTalkingPoints) updateData.keyTalkingPoints = keyTalkingPoints;
    if (objectionHandlers) updateData.objectionHandlers = objectionHandlers;
    if (callToAction) updateData.callToAction = callToAction;
    if (fallbackOffer !== undefined) updateData.fallbackOffer = fallbackOffer;
    if (targetAudience !== undefined) updateData.targetAudience = targetAudience;
    if (language) updateData.language = language;
    if (maxDurationSeconds !== undefined) {
      if (!Number.isInteger(maxDurationSeconds) || maxDurationSeconds < 30 || maxDurationSeconds > 900) {
        return res.status(400).json({ ok: false, error: "maxDurationSeconds must be between 30 and 900" });
      }
      updateData.maxDurationSeconds = maxDurationSeconds;
    }
    if (metadata !== undefined) updateData.metadata = metadata;

    const [updated] = await db
      .update(campaigns)
      .set(updateData)
      .where(and(
        eq(campaigns.id, id),
        eq(campaigns.clientId, req.clientId!),
        eq(campaigns.status, existing.status),
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ ok: false, error: `Campaign ${id} not found` });
    }

    return res.json({ ok: true, campaign: updated });
  } catch (err: unknown) {
    console.error("[campaigns/patch] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}

/**
 * DELETE /api/campaigns/:id
 *
 * Delete a campaign.
 */
export async function deleteCampaignRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Campaign ID is required" });
    }

    const [deleted] = await db
      .delete(campaigns)
      .where(and(
        eq(campaigns.id, id),
        eq(campaigns.clientId, req.clientId!),
        eq(campaigns.status, "draft"),
      ))
      .returning();

    if (!deleted) {
      return res.status(404).json({ ok: false, error: `Campaign ${id} not found` });
    }

    return res.json({ ok: true, message: `Campaign ${id} deleted` });
  } catch (err: unknown) {
    console.error("[campaigns/delete] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
