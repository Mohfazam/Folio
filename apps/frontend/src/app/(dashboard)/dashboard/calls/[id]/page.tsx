import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  CallDetailView,
  type CallDetailRecord,
} from "@/components/dashboard/call-detail";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function textArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toCallDetail(value: unknown): CallDetailRecord | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;

  const contact = isRecord(value.contact) ? value.contact : null;
  const campaign = isRecord(value.campaign) ? value.campaign : null;
  const transcript = Array.isArray(value.transcript)
    ? value.transcript
        .filter(isRecord)
        .map((line) => ({
          speaker: line.speaker === "assistant" ? "assistant" as const : "user" as const,
          text: text(line.text) ?? "",
          timestamp: text(line.timestamp),
          isComplete: line.isComplete !== false,
        }))
    : [];

  return {
    id: value.id,
    contactId: text(value.contactId),
    campaignId: text(value.campaignId),
    contactName: text(value.contactName),
    phoneNumber: text(value.phoneNumber),
    attemptNumber: number(value.attemptNumber) ?? 1,
    startedAt: text(value.startedAt),
    endedAt: text(value.endedAt),
    durationSeconds: number(value.durationSeconds),
    outcome: text(value.outcome) ?? "unknown",
    isBillable: value.isBillable === true,
    creditsCharged: number(value.creditsCharged) ?? 0,
    summary: text(value.summary),
    interestLevel: text(value.interestLevel),
    sentiment: text(value.sentiment),
    objectionsRaised: textArray(value.objectionsRaised),
    followUpRequested: value.followUpRequested === true,
    costTelephony: number(value.costTelephony),
    costStt: number(value.costStt),
    costLlm: number(value.costLlm),
    costTts: number(value.costTts),
    costTotal: number(value.costTotal),
    recordingUrl: text(value.recordingUrl),
    transcript,
    createdAt: text(value.createdAt),
    contact: contact
      ? {
          id: text(contact.id),
          fullName: text(contact.fullName),
          email: text(contact.email),
          companyName: text(contact.companyName),
          jobTitle: text(contact.jobTitle),
          department: text(contact.department),
          industry: text(contact.industry),
          city: text(contact.city),
          leadScore: number(contact.leadScore),
          lifecycleStage: text(contact.lifecycleStage),
          accountTier: text(contact.accountTier),
          courseOrStream: text(contact.courseOrStream),
        }
      : null,
    campaign: campaign
      ? {
          id: text(campaign.id),
          name: text(campaign.name),
          type: text(campaign.type),
          primaryObjective: text(campaign.primaryObjective),
        }
      : null,
  };
}

async function CallDetailContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/sign-in");

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) redirect("/sign-in");

  const baseUrl = process.env.BACKEND_API_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    return <CallDetailView call={null} error="BACKEND_API_URL is not configured for the Next.js server." />;
  }

  try {
    const response = await fetch(
      `${baseUrl}/api/calls/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      },
    );

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const message = isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : response.status === 404
          ? "This call could not be found in your workspace."
          : `Call details request failed (${response.status}).`;
      return <CallDetailView call={null} error={message} />;
    }

    const call = toCallDetail(payload.call);
    if (!call) {
      return <CallDetailView call={null} error="The backend returned an invalid call record." />;
    }

    return <CallDetailView call={call} error={null} />;
  } catch (error) {
    console.error("[dashboard/calls/detail] Unable to load call:", error);
    return (
      <CallDetailView
        call={null}
        error={error instanceof Error ? error.message : "Unable to load call details."}
      />
    );
  }
}

function CallDetailLoading() {
  return (
    <div className="space-y-5" aria-live="polite" aria-busy="true">
      <div className="h-3 w-28 animate-pulse rounded bg-[#E9E8E1]" />
      <div className="h-10 w-64 animate-pulse rounded bg-[#E9E8E1]" />
      <div className="h-28 animate-pulse rounded-[8px] border border-[#ECEBE5] bg-[#FFFEFB]" />
      <div className="h-72 animate-pulse rounded-[8px] border border-[#ECEBE5] bg-[#FFFEFB]" />
      <span className="sr-only">Loading call details…</span>
    </div>
  );
}

export default async function CallDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<CallDetailLoading />}>
      <CallDetailContent params={params} />
    </Suspense>
  );
}
