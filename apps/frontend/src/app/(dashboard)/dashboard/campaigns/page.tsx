import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";
import { CampaignsDashboard } from "@/components/dashboard/campaigns-dashboard";

type JsonRecord = Record<string, unknown>;

type Campaign = {
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

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

function toCampaign(value: unknown): Campaign | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const stats = isRecord(value.stats) ? value.stats : {};
  return {
    id: value.id,
    name: asString(value.name, "Untitled campaign"),
    type: asString(value.type, "outreach_sales"),
    status: asString(value.status, "draft"),
    primaryObjective: asString(value.primaryObjective),
    callOpeningHook: asString(value.callOpeningHook) || undefined,
    keyTalkingPoints: asStringArray(value.keyTalkingPoints),
    objectionHandlers: Array.isArray(value.objectionHandlers) ? value.objectionHandlers : [],
    callToAction: asString(value.callToAction) || undefined,
    fallbackOffer: asNullableString(value.fallbackOffer),
    targetAudience: asNullableString(value.targetAudience),
    language: asNullableString(value.language),
    maxDurationSeconds: asNumber(value.maxDurationSeconds) ?? null,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
    stats: {
      totalCalls: asNumber(stats.totalCalls),
      connectedCalls: asNumber(stats.connectedCalls),
      highInterestCalls: asNumber(stats.highInterestCalls),
      pendingCalls: asNumber(stats.pendingCalls),
      inProgressCalls: asNumber(stats.inProgressCalls),
      failedCalls: asNumber(stats.failedCalls),
      completedQueueCalls: asNumber(stats.completedQueueCalls),
    },
  };
}

async function CampaignsPageContent() {
  await connection();

  const auth = await getDashboardAuthContext();
  if (!auth) redirect("/sign-in");
  const accessToken = auth.accessToken;

  const baseUrl = (
    process.env.BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "http://localhost:4000"
  ).replace(/\/+$/, "");

  try {
    const response = await fetch(`${baseUrl}/api/campaigns`, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const message =
        isRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : `Campaign request failed (${response.status}).`;
      return <CampaignsDashboard initialCampaigns={[]} initialError={message} />;
    }

    const rows = Array.isArray(payload.campaigns) ? payload.campaigns : [];
    return (
      <CampaignsDashboard
        initialCampaigns={rows.map(toCampaign).filter((item): item is Campaign => item !== null)}
        initialError={null}
      />
    );
  } catch (cause) {
    console.error("[dashboard/campaigns] Unable to load campaigns:", cause);
    return (
      <CampaignsDashboard
        initialCampaigns={[]}
        initialError={cause instanceof Error ? cause.message : "Unable to load campaigns."}
      />
    );
  }
}

export default function CampaignsPage() {
  return <CampaignsPageContent />;
}
