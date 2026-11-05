import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { OverviewDashboard } from "@/components/dashboard/overview-dashboard";

type JsonRecord = Record<string, unknown>;

type OverviewMetrics = {
  contactsReached: string | null;
  successfulConversations: string | null;
  followUpsScheduled: string | null;
  campaignCompletion: string | null;
  telemetryAvailable: boolean;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getDisplayValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString("en-US");
  }
  if (typeof value === "string" && value.trim()) return value.trim();
  if (isRecord(value)) {
    const nested = value.value ?? value.count ?? value.total;
    return getDisplayValue(nested);
  }
  return null;
}

function pickMetric(sources: JsonRecord[], keys: string[]): string | null {
  for (const source of sources) {
    for (const key of keys) {
      const value = getDisplayValue(source[key]);
      if (value !== null) return value;
    }
  }
  return null;
}

function normalizeOverview(payload: unknown): OverviewMetrics {
  if (!isRecord(payload)) {
    return {
      contactsReached: null,
      successfulConversations: null,
      followUpsScheduled: null,
      campaignCompletion: null,
      telemetryAvailable: false,
    };
  }

  const data = isRecord(payload.data) ? payload.data : {};
  const sources = [
    isRecord(payload.metrics) ? payload.metrics : {},
    isRecord(data.metrics) ? data.metrics : {},
    isRecord(payload.overview) ? payload.overview : {},
    isRecord(payload.summary) ? payload.summary : {},
    data,
    payload,
  ];

  const contactsReached = pickMetric(sources, ["contactsReached", "contacts_reached"]);
  const successfulConversations = pickMetric(sources, ["successfulConversations", "successful_conversations"]);
  const followUpsScheduled = pickMetric(sources, ["followUpsScheduled", "follow_ups_scheduled"]);
  const campaignCompletion = pickMetric(sources, ["campaignCompletion", "campaign_completion"]);

  return {
    contactsReached,
    successfulConversations,
    followUpsScheduled,
    campaignCompletion,
    telemetryAvailable: [contactsReached, successfulConversations, followUpsScheduled, campaignCompletion].some((value) => value !== null),
  };
}

async function loadOverview(accessToken: string): Promise<OverviewMetrics> {
  const baseUrl = process.env.BACKEND_API_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) return normalizeOverview(null);

  try {
    const response = await fetch(`${baseUrl}/api/analytics/overview`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[dashboard/overview] Analytics request failed:", response.status);
      return normalizeOverview(null);
    }

    const payload: unknown = await response.json();
    return normalizeOverview(payload);
  } catch (error) {
    console.error("[dashboard/overview] Unable to load analytics:", error);
    return normalizeOverview(null);
  }
}

export default async function DashboardPage() {
  await connection();

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) redirect("/sign-in");

  const metrics = await loadOverview(session.access_token);
  return <OverviewDashboard metrics={metrics} />;
}
