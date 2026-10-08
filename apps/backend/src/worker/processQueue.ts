import { eq, lte, sql, and, asc, isNull, inArray } from "drizzle-orm";
import { db } from "../config/db.js";
import { callQueue, clients, contacts, campaigns, businessProfiles, knowledgeBaseEntries } from "@repo/db";
import { env } from "../config/env.js";

/**
 * Concurrency Mutex: prevents duplicate simultaneous worker runs from
 * picking the same queue entries or exceeding client limits.
 */
let isProcessingQueue = false;

/**
 * Extracts current time ("HH:MM:SS") and calendar date ("YYYY-MM-DD") in the client's timezone.
 */
function getClientLocalTimeAndDate(timezone: string, instant = new Date()): { time: string; date: string } {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(instant);
    const year = parts.find((p) => p.type === "year")?.value || "1970";
    const month = parts.find((p) => p.type === "month")?.value || "01";
    const day = parts.find((p) => p.type === "day")?.value || "01";
    const hour = parts.find((p) => p.type === "hour")?.value || "00";
    const minute = parts.find((p) => p.type === "minute")?.value || "00";
    const second = parts.find((p) => p.type === "second")?.value || "00";
    return {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}:${second}`,
    };
  } catch {
    return {
      date: instant.toISOString().slice(0, 10),
      time: instant.toISOString().slice(11, 19),
    };
  }
}

/**
 * Normalizes time string to "HH:MM:SS".
 */
function normalizeTime(t: string | null | undefined, fallback: string): string {
  if (!t) return fallback;
  const trimmed = t.trim();
  if (trimmed.length === 5) return `${trimmed}:00`;
  return trimmed;
}

/**
 * Checks if a normalized time string "HH:MM:SS" falls within a start–end window.
 */
function isWithinCallingHours(currentTime: string, start: string | null, end: string | null): boolean {
  const s = normalizeTime(start, "09:00:00");
  const e = normalizeTime(end, "16:00:00");
  return currentTime >= s && currentTime <= e;
}

async function releaseDialReservation(queueEntryId: string, clientId: string) {
  await db.transaction(async (tx) => {
    const [released] = await tx
      .update(callQueue)
      .set({ status: "pending", reservedCredits: 0, updatedAt: new Date() })
      .where(and(eq(callQueue.id, queueEntryId), eq(callQueue.status, "in_progress")))
      .returning({ reservedCredits: callQueue.reservedCredits });

    if (released) {
      await tx
        .update(clients)
        .set({
          callsMadeToday: sql`greatest(0, ${clients.callsMadeToday} - 1)`,
          creditsReservedThisCycle: sql`greatest(0, ${clients.creditsReservedThisCycle} - ${released.reservedCredits})`,
          updatedAt: new Date(),
        })
        .where(eq(clients.id, clientId));
    }
  });
}

async function recoverExpiredQueueClaims() {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  const staleEntries = await db
    .select({ id: callQueue.id, clientId: callQueue.clientId })
    .from(callQueue)
    .where(and(eq(callQueue.status, "in_progress"), lte(callQueue.updatedAt, cutoff)))
    .limit(100);

  for (const entry of staleEntries) {
    await db.transaction(async (tx) => {
      const [released] = await tx
        .update(callQueue)
        .set({ status: "pending", reservedCredits: 0, updatedAt: new Date() })
        .where(and(
          eq(callQueue.id, entry.id),
          eq(callQueue.status, "in_progress"),
          lte(callQueue.updatedAt, cutoff),
        ))
        .returning({ reservedCredits: callQueue.reservedCredits });

      if (released) {
        await tx
          .update(clients)
          .set({
            creditsReservedThisCycle: sql`greatest(0, ${clients.creditsReservedThisCycle} - ${released.reservedCredits})`,
            updatedAt: new Date(),
          })
          .where(eq(clients.id, entry.clientId));
        console.warn(`[worker] Recovered stale queue entry ${entry.id}`);
      }
    });
  }
}

export interface ProcessQueueResult {
  action: "dialed" | "no_eligible_calls" | "dial_failed" | "already_running";
  contactId?: string;
  clientId?: string;
  queueEntryId?: string;
  error?: string;
}

/**
 * processNextEligibleCall()
 *
 * Core queue worker function.
 * Thread-safe with single-flight mutex.
 */
export async function processNextEligibleCall(): Promise<ProcessQueueResult> {
  if (isProcessingQueue) {
    return { action: "already_running" };
  }

  const callingSecret = process.env.CALLING_SERVICE_SECRET?.trim();
  const webhookSecret = process.env.WEBHOOK_SECRET?.trim();
  if (!callingSecret || !webhookSecret) {
    const error = "CALLING_SERVICE_SECRET and WEBHOOK_SECRET must be configured before dialing";
    console.error(`[worker] ${error}`);
    return { action: "dial_failed", error };
  }

  isProcessingQueue = true;

  try {
    await recoverExpiredQueueClaims();

    // Find distinct clients with pending queue entries scheduled <= now
    const pendingEntries = await db
      .select({
        clientId: callQueue.clientId,
      })
      .from(callQueue)
      .where(
        and(
          eq(callQueue.status, "pending"),
          lte(callQueue.scheduledFor, new Date())
        )
      )
      .groupBy(callQueue.clientId);

    if (pendingEntries.length === 0) {
      return { action: "no_eligible_calls" };
    }

    // Check each client for eligibility
    for (const entry of pendingEntries) {
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, entry.clientId))
        .limit(1);

      if (!client) continue;
      if (client.status === "paused" || client.status === "suspended") continue;

      const clientLocal = getClientLocalTimeAndDate(client.timezone);

      // ── Check 1: Reset callsMadeToday if calendar date changed ────
      const resetDate = client.callsMadeTodayResetAt
        ? getClientLocalTimeAndDate(client.timezone, client.callsMadeTodayResetAt).date
        : undefined;
      if (resetDate !== clientLocal.date) {
        const resetPredicate = client.callsMadeTodayResetAt
          ? eq(clients.callsMadeTodayResetAt, client.callsMadeTodayResetAt)
          : isNull(clients.callsMadeTodayResetAt);
        const [resetClient] = await db
          .update(clients)
          .set({
            callsMadeToday: 0,
            callsMadeTodayResetAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(eq(clients.id, client.id), resetPredicate))
          .returning({ id: clients.id });

        if (resetClient) {
          client.callsMadeToday = 0;
        } else {
          const [latestClient] = await db
            .select()
            .from(clients)
            .where(eq(clients.id, client.id))
            .limit(1);
          if (!latestClient) continue;
          Object.assign(client, latestClient);
        }
      }

      // ── Check 2: Calling hours ─────────────────────────────────
      if (!isWithinCallingHours(clientLocal.time, client.callingHoursStart, client.callingHoursEnd)) {
        console.log(
          `[worker] ⏰ Client ${client.id.slice(0, 8)} outside calling hours (${clientLocal.time} not in ${client.callingHoursStart}–${client.callingHoursEnd} ${client.timezone})`
        );
        continue;
      }

      // ── Check 3: Daily call cap ────────────────────────────────
      if (client.callsMadeToday >= client.maxCallsPerDay) {
        console.log(`[worker] 📊 Client ${client.id.slice(0, 8)} at daily cap (${client.callsMadeToday}/${client.maxCallsPerDay})`);
        continue;
      }

      // ── Check 4: Credit allowance ──────────────────────────────
      if (client.creditsUsedThisCycle + client.creditsReservedThisCycle >= client.monthlyCreditsAllowance) {
        console.log(`[worker] 💳 Client ${client.id.slice(0, 8)} exhausted credits (${client.creditsUsedThisCycle}+${client.creditsReservedThisCycle}/${client.monthlyCreditsAllowance})`);
        continue;
      }

      // ── All checks passed — pick the highest priority & oldest pending entry ──
      const [queueEntry] = await db
        .select()
        .from(callQueue)
        .where(
          and(
            eq(callQueue.clientId, client.id),
            eq(callQueue.status, "pending"),
            lte(callQueue.scheduledFor, new Date())
          )
        )
        .orderBy(asc(callQueue.scheduledFor), sql`${callQueue.priority} DESC`, asc(callQueue.createdAt))
        .limit(1);

      if (!queueEntry) continue;

      // Fetch the contact
      const [contact] = await db
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, queueEntry.contactId), eq(contacts.clientId, client.id)))
        .limit(1);

      if (!contact) {
        console.warn(`[worker] Contact ${queueEntry.contactId} not found for queue entry ${queueEntry.id}`);
        await db
          .update(callQueue)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(callQueue.id, queueEntry.id));
        continue;
      }
      if (contact.optOut || contact.status === "do_not_call" || contact.status === "invalid") {
        await db
          .update(callQueue)
          .set({ status: "failed", updatedAt: new Date() })
          .where(and(eq(callQueue.id, queueEntry.id), eq(callQueue.status, "pending")));
        continue;
      }

      let campaignMaxDurationSeconds = 300;
      if (queueEntry.campaignId) {
        const [campaign] = await db
          .select({ status: campaigns.status, maxDurationSeconds: campaigns.maxDurationSeconds })
          .from(campaigns)
          .where(and(eq(campaigns.id, queueEntry.campaignId), eq(campaigns.clientId, client.id)))
          .limit(1);
        if (!campaign || campaign.status !== "active") {
          await db
            .update(callQueue)
            .set({ status: "failed", updatedAt: new Date() })
            .where(and(eq(callQueue.id, queueEntry.id), eq(callQueue.status, "pending")));
          continue;
        }
        campaignMaxDurationSeconds = campaign.maxDurationSeconds ?? 300;
      } else {
        await db
          .update(callQueue)
          .set({ status: "failed", updatedAt: new Date() })
          .where(and(eq(callQueue.id, queueEntry.id), eq(callQueue.status, "pending")));
        continue;
      }

      const reservedCredits = Math.max(1, Math.ceil(campaignMaxDurationSeconds / 10));
      const [claimedQueueEntry] = await db
        .update(callQueue)
        .set({ status: "in_progress", reservedCredits, updatedAt: new Date() })
        .where(and(eq(callQueue.id, queueEntry.id), eq(callQueue.status, "pending")))
        .returning({ id: callQueue.id });
      if (!claimedQueueEntry) continue;

      const [reservedClient] = await db
        .update(clients)
        .set({
          callsMadeToday: sql`${clients.callsMadeToday} + 1`,
          creditsReservedThisCycle: sql`${clients.creditsReservedThisCycle} + ${reservedCredits}`,
          updatedAt: new Date(),
        })
        .where(and(
          eq(clients.id, client.id),
          inArray(clients.status, ["trialing", "active"]),
          sql`${clients.callsMadeToday} < ${clients.maxCallsPerDay}`,
          sql`${clients.creditsUsedThisCycle} + ${clients.creditsReservedThisCycle} + ${reservedCredits} <= ${clients.monthlyCreditsAllowance}`,
        ))
        .returning({ id: clients.id });
      if (!reservedClient) {
        await db
          .update(callQueue)
          .set({ status: "pending", reservedCredits: 0, updatedAt: new Date() })
          .where(and(eq(callQueue.id, queueEntry.id), eq(callQueue.status, "in_progress")));
        continue;
      }

      // ── Fetch business profile, campaign, and knowledge base ────
      let businessProfile: Record<string, unknown> | undefined;
      let campaign: Record<string, unknown> | undefined;

      const [bp] = await db
        .select()
        .from(businessProfiles)
        .where(eq(businessProfiles.clientId, client.id))
        .limit(1);

      if (bp) {
        businessProfile = {
          displayName: bp.displayName,
          industry: bp.industry,
          tagline: bp.tagline,
          description: bp.description,
          website: bp.website,
          address: bp.address,
          operatingHours: bp.operatingHours,
          supportPhone: bp.supportPhone,
          catalogOfferings: bp.catalogOfferings,
          toneOfVoice: bp.toneOfVoice,
          aiPersonaName: bp.aiPersonaName,
          guardrails: bp.guardrails,
          keyDifferentiators: bp.keyDifferentiators,
          complianceNotes: bp.complianceNotes,
        };
      }

      if (queueEntry.campaignId) {
        const [camp] = await db
          .select()
          .from(campaigns)
          .where(eq(campaigns.id, queueEntry.campaignId))
          .limit(1);

        if (camp) {
          campaign = {
            name: camp.name,
            type: camp.type,
            primaryObjective: camp.primaryObjective,
            callOpeningHook: camp.callOpeningHook,
            keyTalkingPoints: camp.keyTalkingPoints,
            objectionHandlers: camp.objectionHandlers,
            callToAction: camp.callToAction,
            fallbackOffer: camp.fallbackOffer,
            targetAudience: camp.targetAudience,
            language: camp.language,
          };
        }
      }

      // Universal Cross-Industry Contact Context
      const contactContext = {
        fullName: contact.fullName,
        secondaryName: contact.secondaryName,
        phoneNumber: contact.phoneNumber,
        email: contact.email,
        companyName: contact.companyName,
        jobTitle: contact.jobTitle,
        department: contact.department,
        industry: contact.industry,
        city: contact.city,
        state: contact.state,
        country: contact.country,
        timezone: contact.timezone,
        leadScore: contact.leadScore,
        lifecycleStage: contact.lifecycleStage,
        accountTier: contact.accountTier,
        tags: contact.tags,
        parentName: contact.parentName,
        studentName: contact.studentName,
        courseOrStream: contact.courseOrStream,
        contextData: contact.contextData,
        customFields: contact.customFields,
      };

      // Fetch active Knowledge Base entries (prioritized)
      const kbEntries = await db
        .select({
          id: knowledgeBaseEntries.id,
          type: knowledgeBaseEntries.type,
          title: knowledgeBaseEntries.title,
          category: knowledgeBaseEntries.category,
          question: knowledgeBaseEntries.question,
          content: knowledgeBaseEntries.content,
          tags: knowledgeBaseEntries.tags,
          metadata: knowledgeBaseEntries.metadata,
          priority: knowledgeBaseEntries.priority,
          targetPersonas: knowledgeBaseEntries.targetPersonas,
        })
        .from(knowledgeBaseEntries)
        .where(
          and(
            eq(knowledgeBaseEntries.clientId, client.id),
            eq(knowledgeBaseEntries.isActive, true)
          )
        )
        .orderBy(sql`${knowledgeBaseEntries.priority} DESC`, sql`${knowledgeBaseEntries.updatedAt} DESC`)
        .limit(40);

      // Build the request body matching /calling's dialRoute expectations
      const dialBody: Record<string, unknown> = {
        phoneNumber: contact.phoneNumber,
        clientId: client.id,
        contactId: contact.id,
        recordCall: true,
      };

      if (queueEntry.campaignId) {
        dialBody.campaignId = queueEntry.campaignId;
      }

      dialBody.context = {
        business: businessProfile,
        campaign,
        contact: contactContext,
        knowledgeBase: kbEntries.length > 0 ? kbEntries : undefined,
      };

      const callingUrl = `${env.callingServiceUrl.replace(/\/$/, "")}/dial`;

      try {
        console.log(
          `[worker] 📞 Dialing ${contact.fullName || "contact"} (${contact.phoneNumber}) for client ${client.id.slice(0, 8)}...`
        );

        const dialResponse = await fetch(callingUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${callingSecret}`,
          },
          body: JSON.stringify(dialBody),
          signal: AbortSignal.timeout(15000),
        });

        if (!dialResponse.ok) {
          const errorText = await dialResponse.text().catch(() => "");
          console.error(`[worker] ❌ Dial request failed (${dialResponse.status}): ${errorText}`);

          await releaseDialReservation(queueEntry.id, client.id);

          return {
            action: "dial_failed",
            contactId: contact.id,
            clientId: client.id,
            queueEntryId: queueEntry.id,
            error: `Calling service returned ${dialResponse.status}: ${errorText}`,
          };
        }

        const dialResult = await dialResponse.json().catch(() => ({}));
        console.log(`[worker] ✅ Dial initiated:`, dialResult);

        return {
          action: "dialed",
          contactId: contact.id,
          clientId: client.id,
          queueEntryId: queueEntry.id,
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[worker] ❌ Failed to reach calling service at ${callingUrl}:`, message);

        await releaseDialReservation(queueEntry.id, client.id);

        return {
          action: "dial_failed",
          contactId: contact.id,
          clientId: client.id,
          queueEntryId: queueEntry.id,
          error: `Could not reach calling service: ${message}`,
        };
      }
    }

    return { action: "no_eligible_calls" };
  } finally {
    isProcessingQueue = false;
  }
}
