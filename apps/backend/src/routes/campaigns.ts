import type { Request, Response } from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db } from "../config/db.js";
import { campaigns, calls, callQueue, contacts } from "@repo/db";

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

    // Aggregate calls and queue entries once per workspace query rather than
    // issuing two additional queries for every campaign (N+1 query pattern).
    const campaignIds = campaignList.map((campaign) => campaign.id);
    const [callStatsRows, queueStatsRows] = campaignIds.length
      ? await Promise.all([
          db
            .select({
              campaignId: calls.campaignId,
              totalCalls: sql<number>`count(*)::int`,
              connectedCalls: sql<number>`count(case when ${calls.outcome} = 'connected' then 1 end)::int`,
              highInterestCalls: sql<number>`count(case when ${calls.interestLevel} = 'high' then 1 end)::int`,
            })
            .from(calls)
            .where(and(eq(calls.clientId, clientId), inArray(calls.campaignId, campaignIds)))
            .groupBy(calls.campaignId),
          db
            .select({
              campaignId: callQueue.campaignId,
              pendingCalls: sql<number>`count(case when ${callQueue.status} = 'pending' then 1 end)::int`,
              inProgressCalls: sql<number>`count(case when ${callQueue.status} = 'in_progress' then 1 end)::int`,
              failedCalls: sql<number>`count(case when ${callQueue.status} in ('failed', 'exhausted') then 1 end)::int`,
              completedQueueCalls: sql<number>`count(case when ${callQueue.status} = 'completed' then 1 end)::int`,
            })
            .from(callQueue)
            .where(and(eq(callQueue.clientId, clientId), inArray(callQueue.campaignId, campaignIds)))
            .groupBy(callQueue.campaignId),
        ])
      : [[], []];

    const callsByCampaign = new Map<string, (typeof callStatsRows)[number]>(
      callStatsRows.filter((row) => row.campaignId).map((row) => [row.campaignId!, row] as const),
    );
    const queueByCampaign = new Map<string, (typeof queueStatsRows)[number]>(
      queueStatsRows.filter((row) => row.campaignId).map((row) => [row.campaignId!, row] as const),
    );

    const enrichedCampaigns = campaignList.map((campaign) => {
      const stats = callsByCampaign.get(campaign.id);
      const queueStats = queueByCampaign.get(campaign.id);
      return {
        ...campaign,
        stats: {
          totalCalls: stats?.totalCalls ?? 0,
          connectedCalls: stats?.connectedCalls ?? 0,
          highInterestCalls: stats?.highInterestCalls ?? 0,
          pendingCalls: queueStats?.pendingCalls ?? 0,
          inProgressCalls: queueStats?.inProgressCalls ?? 0,
          failedCalls: queueStats?.failedCalls ?? 0,
          completedQueueCalls: queueStats?.completedQueueCalls ?? 0,
        },
      };
    });

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
 * GET /api/campaigns/live-stats
 *
 * Return only changing campaign status and counters for the authenticated workspace.
 * This endpoint is intended for lightweight dashboard polling.
 */
export async function getCampaignLiveStatsRoute(req: Request, res: Response) {
  try {
    const clientId = req.clientId;
    if (!clientId) {
      return res.status(403).json({ ok: false, error: "A provisioned workspace is required" });
    }

    const [campaignRows, callRows, queueRows] = await Promise.all([
      db
        .select({ id: campaigns.id, status: campaigns.status })
        .from(campaigns)
        .where(eq(campaigns.clientId, clientId)),
      db
        .select({
          campaignId: calls.campaignId,
          totalCalls: sql<number>`count(*)::int`,
          connectedCalls: sql<number>`count(case when ${calls.outcome} = 'connected' then 1 end)::int`,
          highInterestCalls: sql<number>`count(case when ${calls.interestLevel} = 'high' then 1 end)::int`,
        })
        .from(calls)
        .where(eq(calls.clientId, clientId))
        .groupBy(calls.campaignId),
      db
        .select({
          campaignId: callQueue.campaignId,
          pendingCalls: sql<number>`count(case when ${callQueue.status} = 'pending' then 1 end)::int`,
          inProgressCalls: sql<number>`count(case when ${callQueue.status} = 'in_progress' then 1 end)::int`,
          failedCalls: sql<number>`count(case when ${callQueue.status} in ('failed', 'exhausted') then 1 end)::int`,
          completedQueueCalls: sql<number>`count(case when ${callQueue.status} = 'completed' then 1 end)::int`,
        })
        .from(callQueue)
        .where(eq(callQueue.clientId, clientId))
        .groupBy(callQueue.campaignId),
    ]);

    const callsByCampaign = new Map<string, (typeof callRows)[number]>();
    for (const row of callRows) {
      if (row.campaignId) callsByCampaign.set(row.campaignId, row);
    }

    const queueByCampaign = new Map<string, (typeof queueRows)[number]>();
    for (const row of queueRows) {
      if (row.campaignId) queueByCampaign.set(row.campaignId, row);
    }

    const liveCampaigns = campaignRows.map((campaign) => {
      const callStats = callsByCampaign.get(campaign.id);
      const queueStats = queueByCampaign.get(campaign.id);
      return {
        id: campaign.id,
        status: campaign.status,
        stats: {
          totalCalls: callStats?.totalCalls ?? 0,
          connectedCalls: callStats?.connectedCalls ?? 0,
          highInterestCalls: callStats?.highInterestCalls ?? 0,
          pendingCalls: queueStats?.pendingCalls ?? 0,
          inProgressCalls: queueStats?.inProgressCalls ?? 0,
          failedCalls: queueStats?.failedCalls ?? 0,
          completedQueueCalls: queueStats?.completedQueueCalls ?? 0,
        },
      };
    });

    return res.json({ ok: true, campaigns: liveCampaigns });
  } catch (err: unknown) {
    console.error("[campaigns/live-stats] Unexpected error:", err);
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
 * Delete a campaign (draft, active, paused, or completed), cancelling any pending
 * queued calls and preserving historical call logs by detaching foreign keys.
 */
export async function deleteCampaignRoute(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ ok: false, error: "Campaign ID is required" });
    }

    const clientId = req.clientId!;

    const deleted = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: campaigns.id })
        .from(campaigns)
        .where(and(eq(campaigns.id, id), eq(campaigns.clientId, clientId)))
        .limit(1);

      if (!existing) {
        return null;
      }

      // 1. Remove unrun pending queue entries and reset those contacts back to pending
      const removedPending = await tx
        .delete(callQueue)
        .where(and(
          eq(callQueue.campaignId, id),
          eq(callQueue.clientId, clientId),
          eq(callQueue.status, "pending"),
        ))
        .returning({ contactId: callQueue.contactId });

      const pendingContactIds = Array.from(
        new Set(removedPending.map((row) => row.contactId).filter(Boolean)),
      );
      if (pendingContactIds.length > 0) {
        await tx
          .update(contacts)
          .set({ status: "pending", updatedAt: new Date() })
          .where(and(
            eq(contacts.clientId, clientId),
            eq(contacts.status, "queued"),
            inArray(contacts.id, pendingContactIds),
          ));
      }

      // 2. Detach remaining historical/in-progress call_queue rows so calls.queueEntryId stays intact
      await tx
        .update(callQueue)
        .set({ campaignId: null, updatedAt: new Date() })
        .where(and(eq(callQueue.campaignId, id), eq(callQueue.clientId, clientId)));

      // 3. Detach historical calls rows so call logs & billing records remain preserved
      await tx
        .update(calls)
        .set({ campaignId: null })
        .where(and(eq(calls.campaignId, id), eq(calls.clientId, clientId)));

      // 4. Delete the campaign itself
      const [deletedCampaign] = await tx
        .delete(campaigns)
        .where(and(eq(campaigns.id, id), eq(campaigns.clientId, clientId)))
        .returning();

      return deletedCampaign ?? null;
    });

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
