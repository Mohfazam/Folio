import type { Request, Response } from "express";
import { eq, and, sql, gte, desc } from "drizzle-orm";
import { db } from "../config/db.js";
import { calls, clients, followUps, callQueue } from "@repo/db";

/**
 * GET /api/analytics/overview
 *
 * Provides aggregated analytics and KPIs for dashboard overview cards and charts.
 *
 * Query params:
 *   clientId: string (required)
 *   timeframe: 'today' | '7d' | '30d' | 'all' (default '30d')
 */
export async function getAnalyticsOverviewRoute(req: Request, res: Response) {
  try {
    const { clientId, timeframe = "30d" } = req.query as {
      clientId?: string;
      timeframe?: string;
    };

    const targetClientId = clientId || req.clientId;
    if (!targetClientId) {
      return res.status(400).json({ ok: false, error: "clientId is required" });
    }

    // 1. Fetch Client Profile & Quota info
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, targetClientId))
      .limit(1);

    if (!client) {
      return res.status(404).json({ ok: false, error: `Client ${targetClientId} not found` });
    }

    // 2. Determine Date Filter Window
    let startDate: Date | null = null;
    const now = new Date();

    if (timeframe === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (timeframe === "7d") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe === "30d") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const conditions = [eq(calls.clientId, targetClientId)];
    if (startDate) {
      conditions.push(gte(calls.startedAt, startDate));
    }

    const whereClause = and(...conditions);

    // 3. Aggregate Call Metrics & Outcomes
    const [callStats] = await db
      .select({
        totalCalls: sql<number>`count(*)::int`,
        connectedCalls: sql<number>`count(case when ${calls.outcome} = 'connected' then 1 end)::int`,
        noAnswerCalls: sql<number>`count(case when ${calls.outcome} = 'no_answer' then 1 end)::int`,
        busyCalls: sql<number>`count(case when ${calls.outcome} = 'busy' then 1 end)::int`,
        droppedEarlyCalls: sql<number>`count(case when ${calls.outcome} = 'dropped_early' then 1 end)::int`,
        failedCalls: sql<number>`count(case when ${calls.outcome} = 'failed' then 1 end)::int`,
        totalDurationSeconds: sql<number>`coalesce(sum(${calls.durationSeconds}), 0)::int`,
        avgDurationSeconds: sql<number>`coalesce(avg(case when ${calls.outcome} = 'connected' then ${calls.durationSeconds} end), 0)::int`,
        totalCreditsCharged: sql<number>`coalesce(sum(${calls.creditsCharged}), 0)::int`,

        // Interest Levels
        highInterestCount: sql<number>`count(case when ${calls.interestLevel} = 'high' then 1 end)::int`,
        mediumInterestCount: sql<number>`count(case when ${calls.interestLevel} = 'medium' then 1 end)::int`,
        lowInterestCount: sql<number>`count(case when ${calls.interestLevel} = 'low' then 1 end)::int`,

        // Sentiments
        positiveSentimentCount: sql<number>`count(case when ${calls.sentiment} = 'positive' then 1 end)::int`,
        neutralSentimentCount: sql<number>`count(case when ${calls.sentiment} = 'neutral' then 1 end)::int`,
        negativeSentimentCount: sql<number>`count(case when ${calls.sentiment} = 'negative' then 1 end)::int`,

        // Follow-ups
        followUpsRequestedCount: sql<number>`count(case when ${calls.followUpRequested} = true then 1 end)::int`,

        // Cost sums
        totalCost: sql<number>`coalesce(sum(${calls.costTotal}), 0)::real`,
        costTelephony: sql<number>`coalesce(sum(${calls.costTelephony}), 0)::real`,
        costStt: sql<number>`coalesce(sum(${calls.costStt}), 0)::real`,
        costLlm: sql<number>`coalesce(sum(${calls.costLlm}), 0)::real`,
        costTts: sql<number>`coalesce(sum(${calls.costTts}), 0)::real`,
      })
      .from(calls)
      .where(whereClause);

    const total = callStats?.totalCalls ?? 0;
    const connected = callStats?.connectedCalls ?? 0;
    const connectionRate = total > 0 ? Number(((connected / total) * 100).toFixed(1)) : 0;

    // 4. Pending & Open Actions Count
    const [queueStats] = await db
      .select({
        pendingCount: sql<number>`count(case when ${callQueue.status} = 'pending' then 1 end)::int`,
        inProgressCount: sql<number>`count(case when ${callQueue.status} = 'in_progress' then 1 end)::int`,
      })
      .from(callQueue)
      .where(eq(callQueue.clientId, targetClientId));

    const [followUpStats] = await db
      .select({
        openFollowUpsCount: sql<number>`count(case when ${followUps.status} = 'open' then 1 end)::int`,
      })
      .from(followUps)
      .where(eq(followUps.clientId, targetClientId));

    // 5. Recent 5 Calls Preview
    const recentCalls = await db
      .select({
        id: calls.id,
        contactName: calls.contactName,
        phoneNumber: calls.phoneNumber,
        startedAt: calls.startedAt,
        durationSeconds: calls.durationSeconds,
        outcome: calls.outcome,
        sentiment: calls.sentiment,
        interestLevel: calls.interestLevel,
        summary: calls.summary,
      })
      .from(calls)
      .where(eq(calls.clientId, targetClientId))
      .orderBy(desc(calls.startedAt))
      .limit(5);

    const creditsRemaining = Math.max(0, client.monthlyCreditsAllowance - client.creditsUsedThisCycle);
    const callsRemainingToday = Math.max(0, client.maxCallsPerDay - client.callsMadeToday);

    return res.json({
      ok: true,
      timeframe,
      client: {
        id: client.id,
        name: client.name,
        planTier: client.planTier,
        status: client.status,
      },
      quota: {
        monthlyCreditsAllowance: client.monthlyCreditsAllowance,
        creditsUsedThisCycle: client.creditsUsedThisCycle,
        creditsRemaining,
        maxCallsPerDay: client.maxCallsPerDay,
        callsMadeToday: client.callsMadeToday,
        callsRemainingToday,
      },
      callMetrics: {
        totalCalls: total,
        connectedCalls: connected,
        unansweredCalls: (callStats?.noAnswerCalls ?? 0) + (callStats?.busyCalls ?? 0),
        droppedEarlyCalls: callStats?.droppedEarlyCalls ?? 0,
        failedCalls: callStats?.failedCalls ?? 0,
        connectionRatePercent: connectionRate,
        totalDurationSeconds: callStats?.totalDurationSeconds ?? 0,
        avgDurationSeconds: callStats?.avgDurationSeconds ?? 0,
        totalCreditsCharged: callStats?.totalCreditsCharged ?? 0,
      },
      leadIntelligence: {
        highInterestCount: callStats?.highInterestCount ?? 0,
        mediumInterestCount: callStats?.mediumInterestCount ?? 0,
        lowInterestCount: callStats?.lowInterestCount ?? 0,
        followUpsRequestedCount: callStats?.followUpsRequestedCount ?? 0,
        sentiments: {
          positive: callStats?.positiveSentimentCount ?? 0,
          neutral: callStats?.neutralSentimentCount ?? 0,
          negative: callStats?.negativeSentimentCount ?? 0,
        },
      },
      pipeline: {
        pendingInQueue: queueStats?.pendingCount ?? 0,
        inProgress: queueStats?.inProgressCount ?? 0,
        openFollowUps: followUpStats?.openFollowUpsCount ?? 0,
      },
      costs: {
        totalEstimatedCost: Number((callStats?.totalCost ?? 0).toFixed(4)),
        telephony: Number((callStats?.costTelephony ?? 0).toFixed(4)),
        stt: Number((callStats?.costStt ?? 0).toFixed(4)),
        llm: Number((callStats?.costLlm ?? 0).toFixed(4)),
        tts: Number((callStats?.costTts ?? 0).toFixed(4)),
      },
      recentCalls,
    });
  } catch (err: unknown) {
    console.error("[analytics/overview] Unexpected error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
