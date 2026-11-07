import type { Request, Response } from "express";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../config/db.js";
import { getUtcDateForTimezone, parseClockTime } from "../utils/retrySchedule.js";
import { processNextEligibleCall } from "../worker/processQueue.js";
import {
  auditLog,
  businessProfiles,
  callQueue,
  calls,
  campaigns,
  clients,
  contacts,
  users,
} from "@repo/db";



const DEFAULT_ROUTING_RULES = {
  callback: { enabled: true, assignToUserId: null, dueInMinutes: 30 },
  highInterest: { enabled: true, assignToUserId: null },
  humanRequested: { enabled: true, assignToUserId: null },
  noAnswer: { enabled: true, retryAfterMinutes: 1440, maxRetries: 2 },
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, max = 2000): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result ? result.slice(0, max) : null;
}


function metadataRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function safeVoiceCatalog(): Array<{ id: string; label: string; language?: string }> {
  const raw = process.env.FOOLIOO_VOICE_CATALOG_JSON;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!isRecord(item) || typeof item.id !== "string" || typeof item.label !== "string") return [];
      return [{
        id: item.id.slice(0, 160),
        label: item.label.slice(0, 100),
        ...(typeof item.language === "string" ? { language: item.language.slice(0, 20) } : {}),
      }];
    });
  } catch {
    console.error("[workspace-setup] Invalid FOOLIOO_VOICE_CATALOG_JSON. Voice catalogue is unavailable.");
    return [];
  }
}


function safeLanguageCatalog(): Array<{ code: string; label: string }> {
  const raw = process.env.FOOLIOO_LANGUAGE_CATALOG_JSON;
  if (!raw) return [{ code: "en-IN", label: "English (India)" }];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [{ code: "en-IN", label: "English (India)" }];
    const options = parsed.flatMap((item) => {
      if (!isRecord(item) || typeof item.code !== "string" || typeof item.label !== "string") return [];
      if (!isValidLanguageTag(item.code)) return [];
      return [{ code: item.code.slice(0, 20), label: item.label.slice(0, 80) }];
    });
    return options.length ? options : [{ code: "en-IN", label: "English (India)" }];
  } catch {
    console.error("[workspace-setup] Invalid FOOLIOO_LANGUAGE_CATALOG_JSON. Using English (India) only.");
    return [{ code: "en-IN", label: "English (India)" }];
  }
}

function isValidLanguageTag(value: string): boolean {
  try {
    return Intl.getCanonicalLocales(value).length === 1;
  } catch {
    return false;
  }
}

function nextAllowedCallingTime(
  now: Date,
  timezone: string,
  startClock: string,
  endClock: string,
): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", hourCycle: "h23",
  }).formatToParts(now);
  const part = (name: string) => Number(parts.find((item) => item.type === name)?.value);
  const year = part("year");
  const month = part("month");
  const day = part("day");
  const localMinutes = part("hour") * 60 + part("minute");
  const start = parseClockTime(startClock);
  const end = parseClockTime(endClock);
  const startMinutes = start.hour * 60 + start.minute;
  const endMinutes = end.hour * 60 + end.minute;

  if (localMinutes >= startMinutes && localMinutes < endMinutes) return now;

  if (localMinutes < startMinutes) {
    return getUtcDateForTimezone(year, month, day, start.hour, start.minute, 0, timezone);
  }

  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  return getUtcDateForTimezone(
    tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(),
    start.hour, start.minute, 0, timezone,
  );
}

/**
 * GET /api/agent-settings
 * Returns the business profile plus the persisted AI-agent configuration.
 * The settings live in business_profiles.metadata.aiAgentSettings so this
 * addition does not require a schema migration.
 */
export async function getAgentSettingsRoute(req: Request, res: Response) {
  try {
    const [profile] = await db.select().from(businessProfiles)
      .where(eq(businessProfiles.clientId, req.clientId!)).limit(1);
    const metadata = metadataRecord(profile?.metadata);
    return res.json({
      ok: true,
      businessProfile: profile ?? null,
      agentSettings: isRecord(metadata.aiAgentSettings) ? metadata.aiAgentSettings : null,
      availableVoices: safeVoiceCatalog(),
      availableLanguages: safeLanguageCatalog(),
    });
  } catch (error) {
    console.error("[agent-settings/get]", error);
    return res.status(500).json({ ok: false, error: "Unable to load your AI agent settings." });
  }
}

/** GET /api/team-members. Workspace-scoped, never returns users from another client. */
export async function getTeamMembersRoute(req: Request, res: Response) {
  try {
    const members = await db.select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      role: users.role,
      avatarUrl: users.avatarUrl,
    }).from(users).where(eq(users.clientId, req.clientId!)).orderBy(desc(users.createdAt));
    return res.json({ ok: true, members, total: members.length });
  } catch (error) {
    console.error("[team-members/get]", error);
    return res.status(500).json({ ok: false, error: "Unable to load workspace members." });
  }
}

/**
 * POST /api/test-calls
 * Queues a single, explicitly confirmed test call to the supplied phone number.
 * The route is protected by requireClientAdmin. The queue worker continues to
 * enforce the test-call duration cap, credit reservation, daily limit, workspace
 * status and calling hours.
 */
export async function createTestCallRoute(req: Request, res: Response) {
  try {
    const body = isRecord(req.body) ? req.body : {};
    if (body.confirmRealCall !== true) {
      return res.status(400).json({ ok: false, error: "Confirm that you want Foolioo to place a real test call." });
    }
    const phoneNumber = cleanText(body.phoneNumber, 24);
    if (!phoneNumber || !/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
      return res.status(400).json({ ok: false, error: "Enter a valid phone number in international format, including the country code." });
    }

    const [profile] = await db.select().from(businessProfiles)
      .where(eq(businessProfiles.clientId, req.clientId!)).limit(1);
    if (!profile) return res.status(409).json({ ok: false, error: "Configure your AI agent before placing a test call." });
    const profileMetadata = metadataRecord(profile.metadata);
    const agentSettings = profileMetadata.aiAgentSettings;
    const agentConfigured = Boolean(
      profile.displayName && profile.description && profile.aiPersonaName && profile.toneOfVoice &&
      isRecord(agentSettings) && cleanText(agentSettings.greeting) && cleanText(agentSettings.primaryObjective) &&
      Array.isArray(profile.guardrails) && profile.guardrails.length > 0
    );
    if (!agentConfigured) {
      return res.status(409).json({ ok: false, error: "Finish and save your AI agent setup before placing a test call." });
    }

    const agentSettingsUpdatedAt = isRecord(agentSettings) && typeof agentSettings.updatedAt === "string"
      ? agentSettings.updatedAt
      : null;

    const [existingContact] = await db.select().from(contacts)
      .where(and(eq(contacts.clientId, req.clientId!), eq(contacts.phoneNumber, phoneNumber))).limit(1);
    if (existingContact && (existingContact.optOut || existingContact.status === "do_not_call")) {
      return res.status(409).json({ ok: false, error: "This phone number is marked as do not call. Foolioo will not place a test call to it." });
    }
    if (existingContact && (existingContact.status === "invalid" || existingContact.isDuplicateOf)) {
      return res.status(409).json({ ok: false, error: "This phone number is marked invalid or duplicate. Enter another test-call number." });
    }

    const launchNow = new Date();
    const created = await db.transaction(async (tx) => {
      // Serialize test-call requests per workspace so parallel clicks cannot bypass cooldowns.
      const [client] = await tx.select().from(clients)
        .where(eq(clients.id, req.clientId!)).for("update").limit(1);
      if (!client) return { error: "Workspace not found.", status: 404 as const };
      if (client.status === "suspended" || client.status === "paused") {
        return { error: "Outbound calling is currently unavailable for this workspace.", status: 403 as const };
      }

      const clientMetadata = metadataRecord(client.metadata);
      const latestTestCall = isRecord(clientMetadata.latestTestCall) ? clientMetadata.latestTestCall : null;
      const requestedAt = latestTestCall && typeof latestTestCall.requestedAt === "string"
        ? new Date(latestTestCall.requestedAt).getTime()
        : 0;
      if (Number.isFinite(requestedAt) && requestedAt > 0 && Date.now() - requestedAt < 120_000) {
        return { error: "Please wait two minutes before requesting another test call.", status: 429 as const };
      }

      const creditsRemaining = Math.max(0, client.monthlyCreditsAllowance - client.creditsUsedThisCycle - client.creditsReservedThisCycle);
      const callsRemainingToday = Math.max(0, client.maxCallsPerDay - client.callsMadeToday);
      // The queue worker caps a test call at 120 seconds and reserves one credit
      // per ten-second unit before contacting the telephony provider.
      const testCallCreditReservation = 12;
      if (creditsRemaining < testCallCreditReservation || callsRemainingToday <= 0) {
        return { error: "Your workspace needs at least 12 available voice credits and one remaining daily call to place a two-minute test call.", status: 409 as const };
      }

      const scheduledFor = launchNow;

      const [existingContact] = await tx.select({
        id: contacts.id,
        optOut: contacts.optOut,
        status: contacts.status,
        isDuplicateOf: contacts.isDuplicateOf,
      }).from(contacts)
        .where(and(eq(contacts.clientId, req.clientId!), eq(contacts.phoneNumber, phoneNumber))).limit(1);
      if (existingContact && (existingContact.optOut || existingContact.status === "do_not_call" || existingContact.status === "invalid" || existingContact.status === "queued" || existingContact.status === "in_progress" || existingContact.isDuplicateOf)) {
        return { error: "This phone number is not eligible for a test call.", status: 409 as const };
      }

      // Always create an isolated system contact. Reusing a real CRM contact for a
      // test call would mutate its lifecycle state and could leak the test into
      // normal contact/campaign workflows.
      const [insertedContact] = await tx.insert(contacts).values({
        clientId: req.clientId!,
        fullName: "Foolioo test call",
        phoneNumber,
        phoneNumberRaw: phoneNumber,
        lifecycleStage: "system_test",
        tags: ["__foolioo_test_call__"],
        customFields: { _fooliooSystem: "test_call", createdByUserId: req.user?.id ?? null },
        status: "pending",
        optOut: false,
      }).returning({ id: contacts.id });
      if (!insertedContact) {
        throw new Error("Failed to create a contact for the test call.");
      }
      const contactId = insertedContact.id;

      const [queueEntry] = await tx.insert(callQueue).values({
        contactId,
        clientId: req.clientId!,
        campaignId: null,
        contactName: "Foolioo test call",
        phoneNumber,
        scheduledFor,
        attemptNumber: 1,
        priority: 100,
        status: "pending",
        maxAttempts: 1,
        reservedCredits: 0,
      }).returning();
      if (!queueEntry) {
        throw new Error("Failed to queue the test call.");
      }

      const requestedAtIso = new Date().toISOString();
      await tx.update(clients).set({
        metadata: sql`jsonb_set(COALESCE(${clients.metadata}, '{}'::jsonb), '{latestTestCall}', ${JSON.stringify({ queueId: queueEntry.id, contactId, phoneLast4: phoneNumber.slice(-4), requestedAt: requestedAtIso, agentSettingsUpdatedAt })}::jsonb, true)`,
        updatedAt: new Date(),
      }).where(eq(clients.id, req.clientId!));
      await tx.insert(auditLog).values({
        clientId: req.clientId!,
        userId: req.user?.id ?? null,
        action: "test_call.queued",
        metadata: { queueId: queueEntry.id, phoneLast4: phoneNumber.slice(-4) },
      });

      return { queueEntry, contactId, scheduledFor };
    });

    if ("error" in created && typeof created.error === "string") {
      if (typeof created.status !== "number") throw new Error("Test call returned an invalid error status.");
      return res.status(created.status).json({ ok: false, error: created.error });
    }
    if (!created.queueEntry || !created.scheduledFor) {
      throw new Error("Test call was not queued correctly.");
    }

    void processNextEligibleCall().catch((error) => {
      console.error("[test-calls/create] Queue worker trigger failed:", error);
    });

    return res.status(202).json({
      ok: true,
      testCall: { id: created.queueEntry.id, status: created.queueEntry.status, phoneNumber, contactId: created.contactId, scheduledFor: created.scheduledFor.toISOString() },
      message: "Your test call has been added to the outbound queue and will be attempted as soon as the calling service is available.",
    });
  } catch (error) {
    console.error("[test-calls/create]", error);
    return res.status(500).json({ ok: false, error: "Unable to queue your test call." });
  }
}

/** GET /api/test-calls/:id */
export async function getTestCallRoute(req: Request, res: Response) {
  try {
    const id = typeof req.params.id === "string" ? req.params.id : "";
    const [client] = await db.select({ metadata: clients.metadata }).from(clients)
      .where(eq(clients.id, req.clientId!)).limit(1);
    const latestTestCall = metadataRecord(client?.metadata).latestTestCall;
    if (!isRecord(latestTestCall) || latestTestCall.queueId !== id) {
      return res.status(404).json({ ok: false, error: "Test call was not found." });
    }
    const [queueEntry] = await db.select().from(callQueue)
      .where(and(eq(callQueue.id, id), eq(callQueue.clientId, req.clientId!))).limit(1);
    if (!queueEntry) return res.status(404).json({ ok: false, error: "Test call was not found." });

    const [call] = await db.select({
      id: calls.id,
      outcome: calls.outcome,
      startedAt: calls.startedAt,
      endedAt: calls.endedAt,
      durationSeconds: calls.durationSeconds,
      summary: calls.summary,
      recordingUrl: calls.recordingUrl,
    }).from(calls).where(eq(calls.queueEntryId, queueEntry.id)).orderBy(desc(calls.startedAt)).limit(1);

    return res.json({
      ok: true,
      testCall: {
        id: queueEntry.id,
        status: queueEntry.status,
        scheduledFor: queueEntry.scheduledFor.toISOString(),
        phoneLast4: typeof queueEntry.phoneNumber === "string" ? queueEntry.phoneNumber.slice(-4) : null,
        call: call ?? null,
      },
    });
  } catch (error) {
    console.error("[test-calls/get]", error);
    return res.status(500).json({ ok: false, error: "Unable to load test-call status." });
  }
}

/**
 * GET /api/workspace-setup/eligible-contacts
 * Returns a bounded, server-filtered launch audience. The launch endpoint
 * revalidates every selected ID at commit time.
 */
export async function getLaunchEligibleContactsRoute(req: Request, res: Response) {
  try {
    const requestedLimit = Number(req.query.limit ?? 5000);
    const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(5000, requestedLimit)) : 5000;
    const rows = await db.select({
      id: contacts.id,
      fullName: contacts.fullName,
      companyName: contacts.companyName,
      phoneNumber: contacts.phoneNumber,
      tags: contacts.tags,
      lifecycleStage: contacts.lifecycleStage,
      createdAt: contacts.createdAt,
    }).from(contacts).where(and(
      eq(contacts.clientId, req.clientId!),
      eq(contacts.optOut, false),
      sql`${contacts.isDuplicateOf} IS NULL`,
      sql`${contacts.status} NOT IN ('invalid', 'do_not_call', 'queued', 'in_progress')`,
      sql`COALESCE(${contacts.customFields}->>'_fooliooSystem', '') <> 'test_call'`,
    )).orderBy(desc(contacts.createdAt)).limit(limit);

    const [counts] = await db.select({
      total: sql<number>`count(*)::int`,
    }).from(contacts).where(and(
      eq(contacts.clientId, req.clientId!),
      eq(contacts.optOut, false),
      sql`${contacts.isDuplicateOf} IS NULL`,
      sql`${contacts.status} NOT IN ('invalid', 'do_not_call', 'queued', 'in_progress')`,
      sql`COALESCE(${contacts.customFields}->>'_fooliooSystem', '') <> 'test_call'`,
    ));

    return res.json({
      ok: true,
      contacts: rows,
      total: counts?.total ?? rows.length,
      limit,
      truncated: (counts?.total ?? rows.length) > rows.length,
    });
  } catch (error) {
    console.error("[workspace-setup/eligible-contacts]", error);
    return res.status(500).json({ ok: false, error: "Unable to load eligible contacts for campaign launch." });
  }
}

/** GET /api/workspace-setup. The checklist is derived from workspace records. */
export async function getWorkspaceSetupRoute(req: Request, res: Response) {
  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, req.clientId!)).limit(1);
    if (!client) return res.status(404).json({ ok: false, error: "Workspace not found." });
    const [profile] = await db.select().from(businessProfiles)
      .where(eq(businessProfiles.clientId, req.clientId!)).limit(1);
    const [contactStats] = await db.select({
      usableContacts: sql<number>`count(case when ${contacts.optOut} = false and ${contacts.isDuplicateOf} is null and ${contacts.status} not in ('invalid', 'do_not_call') and COALESCE(${contacts.customFields}->>'_fooliooSystem', '') <> 'test_call' then 1 end)::int`,
    }).from(contacts).where(eq(contacts.clientId, req.clientId!));
    const [campaignStats] = await db.select({
      campaignCount: sql<number>`count(*)::int`,
      activeCampaignCount: sql<number>`count(case when ${campaigns.status} = 'active' then 1 end)::int`,
    }).from(campaigns).where(eq(campaigns.clientId, req.clientId!));

    const metadata = metadataRecord(client.metadata);
    const profileMetadata = metadataRecord(profile?.metadata);
    const agent = profileMetadata.aiAgentSettings;
    const rules = metadata.routingRules;
    const agentConfigured = Boolean(
      profile?.displayName && profile.description && profile.aiPersonaName && profile.toneOfVoice &&
      isRecord(agent) && cleanText(agent.greeting) && cleanText(agent.primaryObjective) &&
      Array.isArray(profile.guardrails) && profile.guardrails.length > 0,
    );
    const usableContacts = contactStats?.usableContacts ?? 0;
    const latestTestCall = isRecord(metadata.latestTestCall) ? metadata.latestTestCall : null;
    let testCallStatus: string | null = null;
    if (latestTestCall && typeof latestTestCall.queueId === "string") {
      const [queueEntry] = await db.select({ status: callQueue.status }).from(callQueue)
        .where(and(eq(callQueue.id, latestTestCall.queueId), eq(callQueue.clientId, req.clientId!))).limit(1);
      testCallStatus = queueEntry?.status ?? null;
    }
    let testCallComplete = false;
    let testCallOutcome: string | null = null;
    if (testCallStatus === "completed" && latestTestCall && typeof latestTestCall.queueId === "string") {
      const [testCall] = await db.select({ outcome: calls.outcome }).from(calls)
        .where(eq(calls.queueEntryId, latestTestCall.queueId)).orderBy(desc(calls.startedAt)).limit(1);
      testCallOutcome = testCall?.outcome ?? null;
      const currentAgentUpdatedAt = typeof profileMetadata.aiAgentSettings === "object" && profileMetadata.aiAgentSettings !== null && !Array.isArray(profileMetadata.aiAgentSettings)
        ? (profileMetadata.aiAgentSettings as Record<string, unknown>).updatedAt
        : null;
      testCallComplete = testCallOutcome === "connected" &&
        (latestTestCall.agentSettingsUpdatedAt ?? null) === (currentAgentUpdatedAt ?? null);
    }
    const savedCampaigns = campaignStats?.campaignCount ?? 0;
    const activeCampaigns = campaignStats?.activeCampaignCount ?? 0;
    const eligibleRouting = isRecord(rules) && rules.configured === true;
    const latestCampaignLaunch = isRecord(metadata.latestCampaignLaunch) ? metadata.latestCampaignLaunch : null;
    const campaignLaunched = Boolean(latestCampaignLaunch && typeof latestCampaignLaunch.campaignId === "string");

    return res.json({
      ok: true,
      setup: {
        agentConfigured,
        contactCount: usableContacts,
        contactsImported: usableContacts > 0,
        testCallRequested: Boolean(latestTestCall),
        testCallComplete,
        testCallStatus,
        testCallOutcome,
        campaignCount: savedCampaigns,
        campaignCreated: savedCampaigns > 0,
        routingConfigured: eligibleRouting,
        activeCampaignCount: activeCampaigns,
        campaignLaunched,
        latestCampaignLaunch,
        callingHours: { start: client.callingHoursStart, end: client.callingHoursEnd, timezone: client.timezone },
      },
    });
  } catch (error) {
    console.error("[workspace-setup/get]", error);
    return res.status(500).json({ ok: false, error: "Unable to verify workspace setup." });
  }
}

/**
 * POST /api/campaigns/:id/launch
 * Validates audience permissions, queues eligible contacts and respects the
 * workspace's local calling window. The queue worker must enforce credits,
 * daily limits, opt-outs and retry timing again immediately before each call.
 */
export async function launchCampaignRoute(req: Request, res: Response) {
  try {
    const campaignId = typeof req.params.id === "string" ? req.params.id : "";
    const body = isRecord(req.body) ? req.body : {};
    const rawIds = Array.isArray(body.contactIds) ? body.contactIds : [];
    const contactIds = [...new Set(rawIds.filter((id): id is string => typeof id === "string" && id.length > 0))];

    if (body.confirm !== true) {
      return res.status(400).json({ ok: false, error: "Explicit confirmation is required before launching a campaign." });
    }
    if (contactIds.length === 0 || contactIds.length > 5000) {
      return res.status(400).json({ ok: false, error: "Select between 1 and 5,000 contacts for this campaign." });
    }

    const launchNow = new Date();
    const result = await db.transaction(async (tx) => {
      // Lock the workspace row to serialize simultaneous campaign launches.
      const [client] = await tx.select().from(clients)
        .where(eq(clients.id, req.clientId!)).for("update").limit(1);
      const [campaign] = await tx.select().from(campaigns)
        .where(and(eq(campaigns.id, campaignId), eq(campaigns.clientId, req.clientId!))).limit(1);
      if (!client || !campaign) return { error: "Campaign or workspace not found.", status: 404 as const };
      if (client.status === "suspended" || client.status === "paused") {
        return { error: "Outbound calling is unavailable for this workspace.", status: 403 as const };
      }
      if (campaign.status !== "draft" && campaign.status !== "paused") {
        return { error: "Only draft or paused campaigns can be launched. Active and completed campaigns cannot be launched again.", status: 409 as const };
      }

      const [profile] = await tx.select().from(businessProfiles)
        .where(eq(businessProfiles.clientId, req.clientId!)).limit(1);
      if (!profile || !isRecord(metadataRecord(profile.metadata).aiAgentSettings)) {
        return { error: "Configure your AI agent before launching a campaign.", status: 409 as const };
      }

      const clientMetadata = metadataRecord(client.metadata);
      const routingRules = isRecord(clientMetadata.routingRules) ? clientMetadata.routingRules : null;
      if (!routingRules || routingRules.configured !== true) {
        return { error: "Save your follow-up and team-handling rules before launching a campaign.", status: 409 as const };
      }

      const latestTestCall = isRecord(clientMetadata.latestTestCall) ? clientMetadata.latestTestCall : null;
      if (!latestTestCall || typeof latestTestCall.queueId !== "string") {
        return { error: "Place a successful test call before launching your first campaign.", status: 409 as const };
      }
      const [testQueue] = await tx.select({ status: callQueue.status }).from(callQueue)
        .where(and(eq(callQueue.id, latestTestCall.queueId), eq(callQueue.clientId, req.clientId!))).limit(1);
      const [testCall] = await tx.select({ outcome: calls.outcome }).from(calls)
        .where(eq(calls.queueEntryId, latestTestCall.queueId)).orderBy(desc(calls.startedAt)).limit(1);
      const currentAgentUpdatedAt = typeof metadataRecord(profile.metadata).aiAgentSettings === "object" && metadataRecord(profile.metadata).aiAgentSettings !== null
        ? (metadataRecord(profile.metadata).aiAgentSettings as Record<string, unknown>).updatedAt
        : null;
      if (testQueue?.status !== "completed" || testCall?.outcome !== "connected" ||
          (latestTestCall.agentSettingsUpdatedAt ?? null) !== (currentAgentUpdatedAt ?? null)) {
        return { error: "Complete a successful test call using your latest saved AI agent settings before launching.", status: 409 as const };
      }

      const selected = await tx.select().from(contacts)
        .where(and(eq(contacts.clientId, req.clientId!), inArray(contacts.id, contactIds)));
      if (selected.length !== contactIds.length) {
        return { error: "One or more selected contacts do not belong to this workspace.", status: 400 as const };
      }

      const eligible = selected.filter((contact) => {
        const customFields = metadataRecord(contact.customFields);
        return customFields._fooliooSystem !== "test_call" && !contact.optOut && !contact.isDuplicateOf &&
          contact.status !== "invalid" && contact.status !== "do_not_call" &&
          contact.status !== "queued" && contact.status !== "in_progress";
      });
      if (eligible.length === 0) {
        return { error: "None of the selected contacts are eligible to call. Remove invalid, duplicate, opted-out or already queued contacts.", status: 409 as const };
      }

      const noAnswer = isRecord(routingRules.noAnswer) ? routingRules.noAnswer : DEFAULT_ROUTING_RULES.noAnswer;
      const maxRetries = noAnswer.enabled === false ? 0 : Math.max(0, Math.min(5, Number(noAnswer.maxRetries ?? 2)));
      const maxAttempts = 1 + maxRetries;

      const creditsRemaining = Math.max(0, client.monthlyCreditsAllowance - client.creditsUsedThisCycle - client.creditsReservedThisCycle);
      const callsRemainingToday = Math.max(0, client.maxCallsPerDay - client.callsMadeToday);
      if (creditsRemaining <= 0) return { error: "No voice credits are available. Review your workspace plan before launching.", status: 409 as const };
      if (callsRemainingToday <= 0) return { error: "Your workspace has reached today's calling limit. You can launch when the daily allowance resets.", status: 409 as const };

      let scheduledFor: Date;
      try {
        scheduledFor = nextAllowedCallingTime(
          launchNow, client.timezone, client.callingHoursStart ?? "09:00:00", client.callingHoursEnd ?? "18:00:00",
        );
      } catch {
        return { error: "Your workspace timezone or calling hours are invalid. Fix them in follow-up and team handling setup.", status: 409 as const };
      }

      const queueRows = eligible.map((contact) => ({
        contactId: contact.id,
        clientId: req.clientId!,
        campaignId: campaign.id,
        contactName: contact.fullName ?? contact.companyName ?? "Contact",
        phoneNumber: contact.phoneNumber,
        scheduledFor,
        attemptNumber: 1,
        priority: 0,
        status: "pending" as const,
        maxAttempts,
        reservedCredits: 0,
      }));
      const inserted = await tx.insert(callQueue).values(queueRows).returning({ id: callQueue.id });
      await tx.update(contacts).set({ status: "queued", updatedAt: new Date() })
        .where(and(eq(contacts.clientId, req.clientId!), inArray(contacts.id, eligible.map((item) => item.id))));
      await tx.update(campaigns).set({ status: "active", updatedAt: new Date() })
        .where(and(eq(campaigns.id, campaign.id), eq(campaigns.clientId, req.clientId!)));
      const launchRecord = { campaignId: campaign.id, launchedAt: launchNow.toISOString(), queuedCount: inserted.length };
      await tx.update(clients).set({
        metadata: sql`jsonb_set(COALESCE(${clients.metadata}, '{}'::jsonb), '{latestCampaignLaunch}', ${JSON.stringify(launchRecord)}::jsonb, true)`,
        updatedAt: launchNow,
      }).where(eq(clients.id, req.clientId!));
      await tx.insert(auditLog).values({
        clientId: req.clientId!,
        userId: req.user?.id ?? null,
        action: "campaign.launched",
        metadata: { campaignId: campaign.id, queuedCount: inserted.length, scheduledFor: scheduledFor.toISOString() },
      });

      return {
        campaignId: campaign.id,
        queued: inserted.length,
        queueEntryIds: inserted.map((row) => row.id),
        scheduledFor: scheduledFor.toISOString(),
        skippedIneligible: selected.length - eligible.length,
      };
    });

    if (!("campaignId" in result)) {
      return res.status(result.status).json({ ok: false, error: result.error });
    }

    void processNextEligibleCall().catch((error) => {
      console.error("[campaigns/launch] Queue worker trigger failed:", error);
    });

    return res.status(202).json({
      ok: true,
      ...result,
      status: "active",
      message: "Campaign activated and eligible contacts added to the outbound queue. The queue worker will process them within workspace limits and calling hours.",
    });
  } catch (error) {
    console.error("[campaigns/launch]", error);
    return res.status(500).json({ ok: false, error: "Unable to launch this campaign." });
  }
}
