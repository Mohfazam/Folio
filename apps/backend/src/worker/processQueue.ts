import { eq, lte, sql, and, asc, isNull, inArray, or } from "drizzle-orm";
import { db } from "../config/db.js";
import { callQueue, clients, contacts, campaigns, businessProfiles, knowledgeBaseEntries } from "@repo/db";
import { env } from "../config/env.js";
import { getWorkspaceAgentRuntimeSettings, isFooliooSystemContact } from "../services/workspaceConfiguration.js";

/**
 * Concurrency Mutex: prevents duplicate simultaneous worker runs from
 * picking the same queue entries or exceeding client limits.
 */
let isProcessingQueue = false;

const systemCallQueueEntry = sql`${callQueue.campaignId} IS NULL AND EXISTS (
  SELECT 1 FROM ${contacts}
  WHERE ${contacts.id} = ${callQueue.contactId}
    AND ${contacts.clientId} = ${callQueue.clientId}
    AND ${contacts.customFields}->>'_fooliooSystem' IN ('test_call', 'public_demo')
)`;

/**
 * Extracts current time ("HH:MM:SS") and calendar date ("YYYY-MM-DD") in the client's timezone.
 */
export function getClientLocalTimeAndDate(timezone: string, instant = new Date()): { time: string; date: string } {
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
export function normalizeTime(t: string | null | undefined, fallback: string): string {
  if (!t) return fallback;
  const trimmed = t.trim();
  if (trimmed.length === 5) return `${trimmed}:00`;
  return trimmed;
}

/**
 * Checks if a normalized time string "HH:MM:SS" falls within a start–end window.
 */
export function isWithinCallingHours(currentTime: string, start: string | null, end: string | null): boolean {
  const s = normalizeTime(start, "09:00:00");
  const e = normalizeTime(end, "16:00:00");
  return currentTime >= s && currentTime <= e;
}

export function isCallingHoursExemptSystemCall(campaignId: string | null, customFields: unknown): boolean {
  if (campaignId !== null || typeof customFields !== "object" || customFields === null || Array.isArray(customFields)) {
    return false;
  }
  const systemType = (customFields as Record<string, unknown>)._fooliooSystem;
  return systemType === "test_call" || systemType === "public_demo";
}

async function releaseDialReservation(
  queueEntryId: string,
  clientId: string,
  nextStatus: "pending" | "failed" = "pending",
) {
  await db.transaction(async (tx) => {
    const [released] = await tx
      .update(callQueue)
      .set({ status: nextStatus, reservedCredits: 0, updatedAt: new Date() })
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
    .select({ id: callQueue.id, clientId: callQueue.clientId, contactId: callQueue.contactId })
    .from(callQueue)
    .where(and(eq(callQueue.status, "in_progress"), lte(callQueue.updatedAt, cutoff)))
    .limit(100);

  for (const entry of staleEntries) {
    await db.transaction(async (tx) => {
      const [released] = await tx
        .update(callQueue)
        .set({ status: "failed", reservedCredits: 0, updatedAt: new Date() })
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
        await tx
          .update(contacts)
          .set({ status: "pending", updatedAt: new Date() })
          .where(and(
            eq(contacts.id, entry.contactId),
            eq(contacts.clientId, entry.clientId),
            eq(contacts.optOut, false),
          ));
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

    // Include system calls queued before test/demo calls were made independent of calling hours.
    const pendingEntries = await db
      .select({
        clientId: callQueue.clientId,
      })
      .from(callQueue)
      .where(
        and(
          eq(callQueue.status, "pending"),
          or(lte(callQueue.scheduledFor, new Date()), systemCallQueueEntry)
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

      const withinCallingHours = isWithinCallingHours(clientLocal.time, client.callingHoursStart, client.callingHoursEnd);
      const activeCampaignRows = await db.select({ id: campaigns.id, metadata: campaigns.metadata })
        .from(campaigns).where(and(eq(campaigns.clientId, client.id), eq(campaigns.status, "active")));
      const campaignIdsWithinWindow = activeCampaignRows.flatMap((campaign) => {
        const metadata = campaign.metadata && typeof campaign.metadata === "object" && !Array.isArray(campaign.metadata)
          ? campaign.metadata as Record<string, unknown> : {};
        const schedule = metadata.campaignSchedule && typeof metadata.campaignSchedule === "object" && !Array.isArray(metadata.campaignSchedule)
          ? metadata.campaignSchedule as Record<string, unknown> : null;
        if (!schedule) return [campaign.id];
        const startsAt = typeof schedule.startAt === "string" ? new Date(schedule.startAt).getTime() : 0;
        const dailyStart = typeof schedule.dailyStart === "string" ? schedule.dailyStart : "09:00";
        const dailyEnd = typeof schedule.dailyEnd === "string" ? schedule.dailyEnd : "18:00";
        const localClock = clientLocal.time.slice(0, 5);
        const inDailyWindow = /^([01]\d|2[0-3]):[0-5]\d$/.test(dailyStart) && /^([01]\d|2[0-3]):[0-5]\d$/.test(dailyEnd)
          && localClock >= dailyStart && localClock < dailyEnd;
        return Number.isFinite(startsAt) && Date.now() >= startsAt && inDailyWindow ? [campaign.id] : [];
      });

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
            withinCallingHours
              ? or(
                  and(inArray(callQueue.campaignId, campaignIdsWithinWindow.length ? campaignIdsWithinWindow : ["00000000-0000-0000-0000-000000000000"]), lte(callQueue.scheduledFor, new Date())),
                  systemCallQueueEntry,
                )
              : systemCallQueueEntry
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

      const systemContact = isFooliooSystemContact(contact.customFields);
      const contactCustomFields = contact.customFields && typeof contact.customFields === "object"
        ? contact.customFields as Record<string, unknown>
        : {};
      const isPublicDemo = contactCustomFields._fooliooSystem === "public_demo";
      const isTestCall = queueEntry.campaignId === null && systemContact;
      if (!withinCallingHours && !isCallingHoursExemptSystemCall(queueEntry.campaignId, contact.customFields)) {
        console.log(
          `[worker] ⏰ Client ${client.id.slice(0, 8)} outside calling hours (${clientLocal.time} not in ${client.callingHoursStart}–${client.callingHoursEnd} ${client.timezone})`
        );
        continue;
      }
      // campaign_id=NULL is reserved for isolated Foolioo system calls: dashboard
      // test calls and the fixed public showcase demo. Never let arbitrary unlinked
      // queue rows become live outbound calls.
      if ((queueEntry.campaignId === null && !isTestCall) || (queueEntry.campaignId !== null && isFooliooSystemContact(contact.customFields))) {
        console.error(`[worker] Rejecting unsupported queue/contact combination for ${queueEntry.id}`);
        await db.update(callQueue)
          .set({ status: "failed", updatedAt: new Date() })
          .where(and(eq(callQueue.id, queueEntry.id), eq(callQueue.status, "pending")));
        continue;
      }

      let agentRuntimeSettings = await getWorkspaceAgentRuntimeSettings(client.id);
      if (isPublicDemo && agentRuntimeSettings) {
        const requestedLanguage = typeof contactCustomFields.publicDemoLanguage === "string"
          ? contactCustomFields.publicDemoLanguage
          : agentRuntimeSettings.language;
        agentRuntimeSettings = { ...agentRuntimeSettings, language: requestedLanguage };
      }
      if (isTestCall && !agentRuntimeSettings) {
        console.error(`[worker] Test call ${queueEntry.id} has no saved agent runtime settings; rejecting it.`);
        await db.update(callQueue)
          .set({ status: "failed", updatedAt: new Date() })
          .where(and(eq(callQueue.id, queueEntry.id), eq(callQueue.status, "pending")));
        continue;
      }

      let campaignMaxDurationSeconds = isTestCall ? 120 : 300;
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
      } else if (!isTestCall) {
        await db
          .update(callQueue)
          .set({ status: "failed", updatedAt: new Date() })
          .where(and(eq(callQueue.id, queueEntry.id), eq(callQueue.status, "pending")));
        continue;
      }

      // Test calls use a bounded two-minute cap and reserve quota exactly like
      // campaign calls. The completion webhook charges actual connected time.
      const reservedCredits = Math.max(1, Math.ceil(campaignMaxDurationSeconds / 10));
      const claimed = await db.transaction(async (tx) => {
        const [claimedQueueEntry] = await tx
          .update(callQueue)
          .set({ status: "in_progress", reservedCredits, updatedAt: new Date() })
          .where(and(eq(callQueue.id, queueEntry.id), eq(callQueue.status, "pending")))
          .returning({ id: callQueue.id });
        if (!claimedQueueEntry) return false;

        const [reservedClient] = await tx
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
          await tx
            .update(callQueue)
            .set({ status: "pending", reservedCredits: 0, updatedAt: new Date() })
            .where(and(eq(callQueue.id, queueEntry.id), eq(callQueue.status, "in_progress")));
          return false;
        }

        return true;
      });
      if (!claimed) continue;

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
          toneOfVoice: agentRuntimeSettings?.tone ?? bp.toneOfVoice,
          aiPersonaName: agentRuntimeSettings?.agentName ?? bp.aiPersonaName,
          guardrails: agentRuntimeSettings?.guardrails ?? bp.guardrails,
          keyDifferentiators: bp.keyDifferentiators,
          complianceNotes: agentRuntimeSettings?.complianceNotes ?? bp.complianceNotes,
          // Provider-independent voice instructions are included for calling
          // runtimes that build their prompt from the business context.
          voiceId: agentRuntimeSettings?.voiceId ?? undefined,
          language: agentRuntimeSettings?.language,
          speechRate: agentRuntimeSettings?.speechRate,
          greeting: agentRuntimeSettings?.greeting,
          primaryObjective: agentRuntimeSettings?.primaryObjective,
          handoffInstructions: agentRuntimeSettings?.handoffInstructions,
          pronunciationNotes: agentRuntimeSettings?.pronunciationNotes,
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
        queueEntryId: queueEntry.id,
        maxDurationSeconds: campaignMaxDurationSeconds,
        recordCall: !isPublicDemo,
      };

      if (queueEntry.campaignId) {
        dialBody.campaignId = queueEntry.campaignId;
      }

      const publicDemoScenario = typeof contactCustomFields.publicDemoScenario === "string"
        ? contactCustomFields.publicDemoScenario
        : "general-enquiry";
      const scenarioGuidance: Record<string, string> = {
        admissions: "Admissions scenario: act as an admissions front desk. Ask which programme or area of study the caller is interested in, explain how a real institute can answer eligibility, application and fee questions, and never invent actual admissions facts.",
        "student-support": "Student support scenario: act as a student-services receptionist. Clarify whether the caller needs help with timetables, campus services or a student query. Explain that a real institute can connect verified student information; do not invent schedules, policies or records.",
        "general-enquiry": "General enquiry scenario: act as the institute's main reception desk. Welcome the caller, understand why they are calling and guide them toward the right department without claiming access to real institute staff or records.",
      };
      const publicDemoInstructions = isPublicDemo
        ? [
            "This is a public Foolioo product demonstration requested by the person receiving this call.",
            "Identify yourself clearly as an AI receptionist in a Foolioo live demo. Do not impersonate a real institute or claim to represent a real school or college.",
            "Demonstrate a realistic, warm, capable educational-institute receptionist conversation. Do not invent course names, fees, eligibility rules, deadlines, locations, or institutional facts. If asked for specifics that are not in the supplied context, say this is a showcase environment and explain that a real institution can connect its own verified information.",
            "Keep the conversation focused, concise, helpful and natural. Invite the recipient to ask a question, handle interruptions politely, and end courteously when they are done.",
            scenarioGuidance[publicDemoScenario] ?? scenarioGuidance["general-enquiry"],
          ].join("\n")
        : undefined;

      dialBody.context = {
        business: businessProfile,
        campaign,
        contact: contactContext,
        knowledgeBase: kbEntries.length > 0 ? kbEntries : undefined,
        // The calling service can apply these settings to its voice/LLM runtime.
        // Existing business fields remain for backward compatibility.
        agentSettings: agentRuntimeSettings,
        workspaceTimezone: client.timezone || "Asia/Kolkata",
        isTestCall,
        isPublicDemo,
        additionalInstructions: publicDemoInstructions,
      };

      const callingUrl = `${env.callingServiceUrl.replace(/\/$/, "")}/dial`;

      try {
        console.log(
          isPublicDemo
            ? `[worker] 📞 Dialing public demo visitor for showcase client ${client.id.slice(0, 8)}...`
            : `[worker] 📞 Dialing ${contact.fullName || "contact"} (${contact.phoneNumber}) for client ${client.id.slice(0, 8)}...`
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

          const outcomeIsAmbiguous =
            dialResponse.status >= 500 ||
            dialResponse.status === 409 ||
            dialResponse.status === 429;
          if (!outcomeIsAmbiguous) {
            await releaseDialReservation(queueEntry.id, client.id, isTestCall ? "failed" : "pending");
          } else {
            console.error(
              `[worker] Dial outcome for queue entry ${queueEntry.id} is ambiguous; retaining its claim to avoid an immediate duplicate call`,
            );
          }

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
        console.error(
          `[worker] Dial outcome for queue entry ${queueEntry.id} is unknown; retaining its claim to avoid an immediate duplicate call`,
        );

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
