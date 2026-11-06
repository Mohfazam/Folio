import { eq } from "drizzle-orm";
import { db } from "../config/db.js";
import { businessProfiles, clients } from "@repo/db";
import { getUtcDateForTimezone, parseClockTime } from "../utils/retrySchedule.js";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function asBoundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

export type WorkspaceAgentRuntimeSettings = {
  agentName: string;
  tone: string;
  language: string;
  speechRate: number;
  voiceId: string | null;
  greeting: string;
  primaryObjective: string;
  handoffInstructions: string;
  pronunciationNotes: string;
  guardrails: string[];
  complianceNotes: string;
};

export type WorkspaceRoutingPolicy = {
  callback: { enabled: boolean; assignToUserId: string | null; dueInMinutes: number };
  highInterest: { enabled: boolean; assignToUserId: string | null };
  humanRequested: { enabled: boolean; assignToUserId: string | null };
  noAnswer: { enabled: boolean; retryAfterMinutes: number; maxRetries: number; maxAttempts: number };
  callingHours: { start: string; end: string; timezone: string };
};

/**
 * Load the exact agent instructions saved by PUT /api/business-profile.
 * Queue workers should use this for both normal campaign calls and test calls.
 */
export async function getWorkspaceAgentRuntimeSettings(clientId: string): Promise<WorkspaceAgentRuntimeSettings | null> {
  const [profile] = await db.select().from(businessProfiles)
    .where(eq(businessProfiles.clientId, clientId)).limit(1);
  if (!profile) return null;

  const metadata = asRecord(profile.metadata);
  const saved = asRecord(metadata.aiAgentSettings);
  if (!Object.keys(saved).length) return null;

  return {
    agentName: typeof saved.agentName === "string" ? saved.agentName : profile.aiPersonaName ?? "Assistant",
    tone: typeof saved.tone === "string" ? saved.tone : profile.toneOfVoice,
    language: typeof saved.language === "string" ? saved.language : "en-IN",
    speechRate: typeof saved.speechRate === "number" ? Math.max(0.8, Math.min(1.2, saved.speechRate)) : 1,
    voiceId: typeof saved.voiceId === "string" ? saved.voiceId : null,
    greeting: typeof saved.greeting === "string" ? saved.greeting : "",
    primaryObjective: typeof saved.primaryObjective === "string" ? saved.primaryObjective : "",
    handoffInstructions: typeof saved.handoffInstructions === "string" ? saved.handoffInstructions : "",
    pronunciationNotes: typeof saved.pronunciationNotes === "string" ? saved.pronunciationNotes : "",
    guardrails: Array.isArray(profile.guardrails) ? profile.guardrails.filter((item): item is string => typeof item === "string") : [],
    complianceNotes: typeof profile.complianceNotes === "string" ? profile.complianceNotes : "",
  };
}

/**
 * Load persisted follow-up routing, retries and calling-hour policy.
 * maxAttempts includes the first attempt, so maxRetries=2 becomes 3 attempts.
 */
export function getWorkspaceRoutingPolicyFromClient(client: {
  metadata: unknown;
  callingHoursStart: string | null;
  callingHoursEnd: string | null;
  timezone: string;
}): WorkspaceRoutingPolicy {
  const metadata = asRecord(client.metadata);
  const saved = asRecord(metadata.routingRules);
  const callback = asRecord(saved.callback);
  const highInterest = asRecord(saved.highInterest);
  const humanRequested = asRecord(saved.humanRequested);
  const noAnswer = asRecord(saved.noAnswer);
  const retryEnabled = noAnswer.enabled !== false;
  const maxRetries = retryEnabled ? asBoundedInteger(noAnswer.maxRetries, 2, 0, 5) : 0;

  return {
    callback: {
      enabled: callback.enabled !== false,
      assignToUserId: typeof callback.assignToUserId === "string" ? callback.assignToUserId : null,
      dueInMinutes: asBoundedInteger(callback.dueInMinutes, 30, 5, 10080),
    },
    highInterest: {
      enabled: highInterest.enabled !== false,
      assignToUserId: typeof highInterest.assignToUserId === "string" ? highInterest.assignToUserId : null,
    },
    humanRequested: {
      enabled: humanRequested.enabled !== false,
      assignToUserId: typeof humanRequested.assignToUserId === "string" ? humanRequested.assignToUserId : null,
    },
    noAnswer: {
      enabled: retryEnabled,
      retryAfterMinutes: asBoundedInteger(noAnswer.retryAfterMinutes, 1440, 15, 10080),
      maxRetries,
      maxAttempts: 1 + maxRetries,
    },
    callingHours: {
      start: client.callingHoursStart ?? "09:00:00",
      end: client.callingHoursEnd ?? "18:00:00",
      timezone: client.timezone || "Asia/Kolkata",
    },
  };
}

export async function getWorkspaceRoutingPolicy(clientId: string): Promise<WorkspaceRoutingPolicy> {
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) throw new Error("Workspace not found while loading routing policy.");
  return getWorkspaceRoutingPolicyFromClient(client);
}

/** Returns true only when the local workspace clock is inside its calling window. */
export function isWithinWorkspaceCallingHours(
  date: Date,
  callingHours: WorkspaceRoutingPolicy["callingHours"],
): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: callingHours.timezone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const localMinutes = get("hour") * 60 + get("minute");
  const start = parseClockTime(callingHours.start);
  const end = parseClockTime(callingHours.end);
  return localMinutes >= start.hour * 60 + start.minute && localMinutes < end.hour * 60 + end.minute;
}

/** Returns the next valid workspace-local time at which a queued call may start. */
export function nextWorkspaceCallingTime(
  date: Date,
  callingHours: WorkspaceRoutingPolicy["callingHours"],
): Date {
  if (isWithinWorkspaceCallingHours(date, callingHours)) return date;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: callingHours.timezone,
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  const localMinutes = get("hour") * 60 + get("minute");
  const start = parseClockTime(callingHours.start);
  const startMinutes = start.hour * 60 + start.minute;

  if (localMinutes < startMinutes) {
    return getUtcDateForTimezone(year, month, day, start.hour, start.minute, 0, callingHours.timezone);
  }

  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  return getUtcDateForTimezone(
    tomorrow.getUTCFullYear(), tomorrow.getUTCMonth() + 1, tomorrow.getUTCDate(),
    start.hour, start.minute, 0, callingHours.timezone,
  );
}

/** Identifies isolated system contacts used for dashboard tests or the public demo. */
export function isFooliooSystemContact(customFields: unknown): boolean {
  const marker = asRecord(customFields)._fooliooSystem;
  return marker === "test_call" || marker === "public_demo";
}
