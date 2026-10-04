import { eq, lte, sql, and, asc } from "drizzle-orm";
import { db } from "../config/db.js";
import { callQueue, clients, contacts, campaigns, businessProfiles } from "@repo/db";
import { env } from "../config/env.js";

/**
 * Converts a time-of-day into "HH:MM" for comparison against client
 * callingHoursStart / callingHoursEnd, accounting for the client's timezone.
 */
function getCurrentTimeInTimezone(timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    return formatter.format(new Date()); // "HH:MM:SS"
  } catch {
    // Fallback to UTC if timezone is invalid
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date());
  }
}

/**
 * Checks if a time string "HH:MM:SS" falls within a start–end window.
 * callingHoursStart / callingHoursEnd are stored as SQL TIME ("HH:MM:SS").
 */
function isWithinCallingHours(currentTime: string, start: string | null, end: string | null): boolean {
  const s = start ?? "09:00:00";
  const e = end ?? "16:00:00";
  return currentTime >= s && currentTime <= e;
}

export interface ProcessQueueResult {
  action: "dialed" | "no_eligible_calls" | "dial_failed";
  contactId?: string;
  clientId?: string;
  queueEntryId?: string;
  error?: string;
}

/**
 * processNextEligibleCall()
 *
 * Core queue worker function. Called from two places:
 * 1. POST /api/calls/complete — event-driven, right after saving a call result
 * 2. POST /api/queue/process  — cron safety net, called every 1–2 minutes
 *
 * Logic:
 * 1. Find clients with pending queue entries where scheduledFor <= now
 * 2. For each client, check eligibility (calling hours, daily cap, credit allowance)
 * 3. If eligible, pick the oldest pending entry, mark it in_progress, dial via /calling
 * 4. Stop after dialing ONE call — sequential by design
 */
export async function processNextEligibleCall(): Promise<ProcessQueueResult> {
  // Find distinct clients that have at least one pending queue entry ready to go
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

    // ── Check 1: Reset callsMadeToday if stale ──────────────────
    if (client.callsMadeTodayResetAt) {
      const resetTime = new Date(client.callsMadeTodayResetAt).getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;
      if (Date.now() - resetTime > oneDayMs) {
        await db
          .update(clients)
          .set({
            callsMadeToday: 0,
            callsMadeTodayResetAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(clients.id, client.id));
        client.callsMadeToday = 0;
      }
    }

    // ── Check 2: Calling hours ─────────────────────────────────
    const clientTime = getCurrentTimeInTimezone(client.timezone);
    if (!isWithinCallingHours(clientTime, client.callingHoursStart, client.callingHoursEnd)) {
      console.log(`[worker] ⏰ Client ${client.id.slice(0, 8)} outside calling hours (${clientTime} not in ${client.callingHoursStart}–${client.callingHoursEnd})`);
      continue;
    }

    // ── Check 3: Daily call cap ────────────────────────────────
    if (client.callsMadeToday >= client.maxCallsPerDay) {
      console.log(`[worker] 📊 Client ${client.id.slice(0, 8)} at daily cap (${client.callsMadeToday}/${client.maxCallsPerDay})`);
      continue;
    }

    // ── Check 4: Credit allowance ──────────────────────────────
    if (client.creditsUsedThisCycle >= client.monthlyCreditsAllowance) {
      console.log(`[worker] 💳 Client ${client.id.slice(0, 8)} exhausted credits (${client.creditsUsedThisCycle}/${client.monthlyCreditsAllowance})`);
      continue;
    }

    // ── All checks passed — find the oldest pending entry for this client ──
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
      .orderBy(asc(callQueue.scheduledFor), asc(callQueue.createdAt))
      .limit(1);

    if (!queueEntry) continue;

    // Fetch the contact
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, queueEntry.contactId))
      .limit(1);

    if (!contact) {
      console.warn(`[worker] Contact ${queueEntry.contactId} not found for queue entry ${queueEntry.id}`);
      await db
        .update(callQueue)
        .set({ status: "failed", updatedAt: new Date() })
        .where(eq(callQueue.id, queueEntry.id));
      continue;
    }

    // Mark the queue entry as in_progress
    await db
      .update(callQueue)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(callQueue.id, queueEntry.id));

    // Increment callsMadeToday + set resetAt if not set
    await db
      .update(clients)
      .set({
        callsMadeToday: sql`${clients.callsMadeToday} + 1`,
        callsMadeTodayResetAt: client.callsMadeTodayResetAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(clients.id, client.id));

    // ── Build context for /calling's /dial endpoint ────────────
    // /calling's dialRoute accepts these params (from routes/dial.ts):
    //   phoneNumber, clientId, contactId, campaignId, instructions,
    //   context (with business/campaign/contact sub-objects), greetingText,
    //   callbackUrl, recordCall, language

    // Fetch business profile and campaign if available, to build rich context
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
        };
      }
    }

    const contactContext = {
      fullName: contact.fullName,
      phoneNumber: contact.phoneNumber,
      parentName: contact.parentName,
      studentName: contact.studentName,
      courseOrStream: contact.courseOrStream,
      contextData: contact.contextData,
      customFields: contact.customFields,
    };

    // Build the request body matching /calling's dialRoute expectations
    const dialBody: Record<string, unknown> = {
      phoneNumber: contact.phoneNumber,
      clientId: client.id,
      contactId: contact.id,
      callbackUrl: `${env.callingServiceUrl.replace(/\/$/, "").replace(env.callingServiceUrl, "")}`,
      recordCall: true,
    };

    // The callbackUrl should point BACK to this backend's /api/calls/complete
    // We need our own public URL for this — but since we don't know it in env
    // yet, we leave it for the /calling service's CALLBACK_URL env var fallback.
    // If /calling has CALLBACK_URL set to point to this backend, it will work.
    // Delete the empty callbackUrl and rely on /calling's env-level CALLBACK_URL.
    delete dialBody.callbackUrl;

    if (queueEntry.campaignId) {
      dialBody.campaignId = queueEntry.campaignId;
    }

    // Pass structured context if we have business/campaign data
    if (businessProfile || campaign) {
      dialBody.context = {
        business: businessProfile,
        campaign,
        contact: contactContext,
      };
    }

    // ── Trigger the dial via /calling's POST /dial endpoint ────
    const callingUrl = `${env.callingServiceUrl.replace(/\/$/, "")}/dial`;

    try {
      console.log(`[worker] 📞 Dialing contact ${contact.id.slice(0, 8)} (${contact.phoneNumber}) for client ${client.id.slice(0, 8)}...`);

      const dialResponse = await fetch(callingUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dialBody),
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      if (!dialResponse.ok) {
        const errorText = await dialResponse.text().catch(() => "");
        console.error(`[worker] ❌ Dial request failed (${dialResponse.status}): ${errorText}`);

        // Revert queue entry to pending so it can be retried
        await db
          .update(callQueue)
          .set({ status: "pending", updatedAt: new Date() })
          .where(eq(callQueue.id, queueEntry.id));

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

      // Revert queue entry to pending so it can be retried on next invocation
      await db
        .update(callQueue)
        .set({ status: "pending", updatedAt: new Date() })
        .where(eq(callQueue.id, queueEntry.id));

      return {
        action: "dial_failed",
        contactId: contact.id,
        clientId: client.id,
        queueEntryId: queueEntry.id,
        error: `Could not reach calling service: ${message}`,
      };
    }
  }

  // All clients checked, none were eligible
  return { action: "no_eligible_calls" };
}
