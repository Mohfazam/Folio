import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { clients } from "@repo/db";
import { db } from "../config/db.js";

const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Loads a workspace and enforces the end of its free trial.
 *
 * Existing trial workspaces without trialEndsAt are backfilled from
 * createdAt + 7 days, matching the 7-day trial offered at signup.
 * When the trial expires, the workspace is suspended and its allowance is
 * reduced to credits already consumed. This makes remaining trial credits zero
 * without rewriting historical usage or interfering with already-reserved calls.
 */
export async function enforceTrialExpiration(
  clientId: string,
  now = new Date(),
): Promise<typeof clients.$inferSelect | null> {
  let [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) return null;
  if (client.planTier !== "trial" || !["trialing", "paused", "suspended"].includes(client.status)) {
    return client;
  }

  if (!client.trialEndsAt) {
    const inferredTrialEnd = new Date(
      client.createdAt.getTime() + TRIAL_DURATION_MS,
    );

    const [backfilledClient] = await db
      .update(clients)
      .set({
        trialEndsAt: inferredTrialEnd,
        updatedAt: now,
      })
      .where(
        and(
          eq(clients.id, clientId),
          eq(clients.planTier, "trial"),
          inArray(clients.status, ["trialing", "paused", "suspended"]),
          isNull(clients.trialEndsAt),
        ),
      )
      .returning();

    if (backfilledClient) {
      client = backfilledClient;
    } else {
      [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);
    }

    if (!client) return null;
    if (client.planTier !== "trial" || !["trialing", "paused", "suspended"].includes(client.status)) {
      return client;
    }
  }

  if (!client.trialEndsAt || client.trialEndsAt.getTime() > now.getTime()) {
    return client;
  }

  if (client.status === "suspended" && client.monthlyCreditsAllowance <= client.creditsUsedThisCycle) {
    return client;
  }

  const [expiredClient] = await db
    .update(clients)
    .set({
      status: "suspended",
      monthlyCreditsAllowance: sql`LEAST(${clients.monthlyCreditsAllowance}, ${clients.creditsUsedThisCycle})`,
      updatedAt: now,
    })
    .where(
      and(
        eq(clients.id, clientId),
        eq(clients.planTier, "trial"),
        inArray(clients.status, ["trialing", "paused", "suspended"]),
        lte(clients.trialEndsAt, now),
      ),
    )
    .returning();

  if (expiredClient) return expiredClient;

  const [latestClient] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  return latestClient ?? null;
}
