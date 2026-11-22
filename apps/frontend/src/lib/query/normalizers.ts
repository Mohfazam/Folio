import type { CallRecord } from "@/components/dashboard/calls-dashboard";
import type { ContactRecord } from "@/components/dashboard/contacts-dashboard";
import type { FollowUpRecord } from "@/components/dashboard/follow-ups-dashboard";

type JsonRecord = Record<string, unknown>;

export type CampaignRecord = {
  id: string;
  name: string;
  type: string;
  status: string;
  primaryObjective: string;
  callOpeningHook?: string;
  keyTalkingPoints?: string[];
  objectionHandlers?: unknown[];
  callToAction?: string;
  fallbackOffer?: string | null;
  targetAudience?: string | null;
  language?: string | null;
  maxDurationSeconds?: number | null;
  createdAt: string | null;
  updatedAt?: string | null;
  stats: {
    totalCalls?: number;
    connectedCalls?: number;
    highInterestCalls?: number;
    pendingCalls?: number;
    inProgressCalls?: number;
    failedCalls?: number;
    completedQueueCalls?: number;
  };
};

export type FollowUpContactOption = {
  id: string;
  fullName: string;
  phoneNumber: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function nullableTrimmedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

export function toCall(value: unknown): CallRecord | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;

  return {
    id: value.id,
    contactId: typeof value.contactId === "string" ? value.contactId : null,
    campaignId: typeof value.campaignId === "string" ? value.campaignId : null,
    contactName: nullableString(value.contactName),
    phoneNumber: nullableString(value.phoneNumber),
    attemptNumber: nullableNumber(value.attemptNumber) ?? 1,
    startedAt: nullableString(value.startedAt),
    endedAt: nullableString(value.endedAt),
    durationSeconds: nullableNumber(value.durationSeconds),
    outcome: typeof value.outcome === "string" ? value.outcome : "unknown",
    isBillable: value.isBillable === true,
    creditsCharged: nullableNumber(value.creditsCharged) ?? 0,
    summary: nullableString(value.summary),
    interestLevel: nullableString(value.interestLevel),
    sentiment: nullableString(value.sentiment),
    followUpRequested: value.followUpRequested === true,
    costTotal: nullableNumber(value.costTotal),
    recordingUrl: nullableString(value.recordingUrl),
    campaignName: nullableString(value.campaignName),
  };
}

export function toCampaign(value: unknown): CampaignRecord | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const stats = isRecord(value.stats) ? value.stats : {};
  return {
    id: value.id,
    name: asString(value.name, "Untitled campaign"),
    type: asString(value.type, "outreach_sales"),
    status: asString(value.status, "draft"),
    primaryObjective: asString(value.primaryObjective),
    callOpeningHook: asString(value.callOpeningHook) || undefined,
    keyTalkingPoints: optionalStringArray(value.keyTalkingPoints),
    objectionHandlers: Array.isArray(value.objectionHandlers) ? value.objectionHandlers : [],
    callToAction: asString(value.callToAction) || undefined,
    fallbackOffer: nullableTrimmedString(value.fallbackOffer),
    targetAudience: nullableTrimmedString(value.targetAudience),
    language: nullableTrimmedString(value.language),
    maxDurationSeconds: optionalNumber(value.maxDurationSeconds) ?? null,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
    stats: {
      totalCalls: optionalNumber(stats.totalCalls),
      connectedCalls: optionalNumber(stats.connectedCalls),
      highInterestCalls: optionalNumber(stats.highInterestCalls),
      pendingCalls: optionalNumber(stats.pendingCalls),
      inProgressCalls: optionalNumber(stats.inProgressCalls),
      failedCalls: optionalNumber(stats.failedCalls),
      completedQueueCalls: optionalNumber(stats.completedQueueCalls),
    },
  };
}

export function toContact(value: unknown): ContactRecord | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;

  const tags = Array.isArray(value.tags)
    ? value.tags.filter((tag): tag is string => typeof tag === "string")
    : [];

  return {
    id: value.id,
    fullName: typeof value.fullName === "string" ? value.fullName : "",
    secondaryName: typeof value.secondaryName === "string" ? value.secondaryName : "",
    phoneNumber: typeof value.phoneNumber === "string" ? value.phoneNumber : "",
    phoneNumberRaw: typeof value.phoneNumberRaw === "string" ? value.phoneNumberRaw : "",
    email: typeof value.email === "string" ? value.email : "",
    companyName: typeof value.companyName === "string" ? value.companyName : "",
    jobTitle: typeof value.jobTitle === "string" ? value.jobTitle : "",
    department: typeof value.department === "string" ? value.department : "",
    industry: typeof value.industry === "string" ? value.industry : "",
    city: typeof value.city === "string" ? value.city : "",
    state: typeof value.state === "string" ? value.state : "",
    country: typeof value.country === "string" ? value.country : "",
    timezone: typeof value.timezone === "string" ? value.timezone : "",
    leadScore: typeof value.leadScore === "number" ? value.leadScore : null,
    lifecycleStage: typeof value.lifecycleStage === "string" ? value.lifecycleStage : "",
    tags,
    parentName: typeof value.parentName === "string" ? value.parentName : "",
    studentName: typeof value.studentName === "string" ? value.studentName : "",
    courseOrStream: typeof value.courseOrStream === "string" ? value.courseOrStream : "",
    status: typeof value.status === "string" ? value.status : "pending",
    optOut: value.optOut === true,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

export function toFollowUp(value: unknown): FollowUpRecord | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const contact = isRecord(value.contact) ? value.contact : null;
  const call = isRecord(value.call) ? value.call : null;
  return {
    id: value.id,
    contactId: typeof value.contactId === "string" ? value.contactId : "",
    callId: nullableString(value.callId),
    type: typeof value.type === "string" ? value.type : "call_back",
    priority: typeof value.priority === "string" ? value.priority : "medium",
    dueDate: nullableString(value.dueDate),
    requestedCallbackTime: nullableString(value.requestedCallbackTime),
    assignedTo: nullableString(value.assignedTo),
    status: typeof value.status === "string" ? value.status : "open",
    notes: nullableString(value.notes),
    createdAt: nullableString(value.createdAt),
    contact: contact
      ? {
          id: nullableString(contact.id),
          fullName: nullableString(contact.fullName),
          phoneNumber: nullableString(contact.phoneNumber),
          email: nullableString(contact.email),
          companyName: nullableString(contact.companyName),
          courseOrStream: nullableString(contact.courseOrStream),
        }
      : null,
    call: call
      ? {
          id: nullableString(call.id),
          startedAt: nullableString(call.startedAt),
          outcome: nullableString(call.outcome),
          sentiment: nullableString(call.sentiment),
          interestLevel: nullableString(call.interestLevel),
          durationSeconds: typeof call.durationSeconds === "number" ? call.durationSeconds : null,
          summary: nullableString(call.summary),
        }
      : null,
  };
}

export function toFollowUpContact(value: unknown): FollowUpContactOption | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  return {
    id: value.id,
    fullName:
      typeof value.fullName === "string" && value.fullName.trim()
        ? value.fullName
        : "Unnamed contact",
    phoneNumber: typeof value.phoneNumber === "string" ? value.phoneNumber : "",
  };
}
