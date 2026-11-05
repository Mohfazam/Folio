import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  OverviewDashboard,
  type DashboardOverviewData,
  type JsonRecord,
  type AnalyticsOverview,
  type CollectionSnapshot,
} from "@/components/dashboard/overview-dashboard";

type ApiEnvelope = JsonRecord & { ok?: boolean; error?: string };

type LoadResult<T> =
  | { state: "ready"; data: T }
  | { state: "error"; error: string; status?: number };

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function getBackendPayload(
  path: string,
  accessToken: string,
): Promise<{ status: number; payload: ApiEnvelope }> {
  const baseUrl = process.env.BACKEND_API_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) throw new Error("BACKEND_API_URL is not configured for the Next.js server.");

  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  const payload: unknown = await response.json().catch(() => null);
  if (!isRecord(payload)) {
    throw Object.assign(new Error(`The backend returned an invalid response for ${path}.`), {
      status: response.status,
    });
  }

  return { status: response.status, payload: payload as ApiEnvelope };
}

async function loadAnalytics(accessToken: string): Promise<LoadResult<AnalyticsOverview>> {
  try {
    const { status, payload } = await getBackendPayload(
      "/api/analytics/overview?timeframe=30d",
      accessToken,
    );

    if (status < 200 || status >= 300 || payload.ok !== true) {
      return {
        state: "error",
        status,
        error: typeof payload.error === "string" ? payload.error : `Analytics request failed (${status}).`,
      };
    }

    const callMetrics = payload.callMetrics;
    const pipeline = payload.pipeline;
    const quota = payload.quota;
    const leadIntelligence = payload.leadIntelligence;
    const costs = payload.costs;

    if (!isRecord(callMetrics) || !isRecord(pipeline) || !isRecord(quota)) {
      return { state: "error", status, error: "The analytics response is missing callMetrics, pipeline, or quota." };
    }

    return {
      state: "ready",
      data: {
        timeframe: typeof payload.timeframe === "string" ? payload.timeframe : "30d",
        client: isRecord(payload.client) ? payload.client : {},
        quota,
        callMetrics,
        leadIntelligence: isRecord(leadIntelligence) ? leadIntelligence : {},
        pipeline,
        costs: isRecord(costs) ? costs : {},
        recentCalls: Array.isArray(payload.recentCalls)
          ? payload.recentCalls.filter(isRecord)
          : [],
      },
    };
  } catch (error) {
    console.error("[dashboard/overview] Analytics request failed:", error);
    return { state: "error", error: error instanceof Error ? error.message : "Unable to load analytics." };
  }
}

function extractCollection(
  payload: ApiEnvelope,
  keys: string[],
): CollectionSnapshot {
  const data = isRecord(payload.data) ? payload.data : {};
  let rawItems: unknown[] | null = null;

  for (const source of [payload, data]) {
    for (const key of [...keys, "items", "results"] ) {
      const candidate = source[key];
      if (Array.isArray(candidate)) {
        rawItems = candidate;
        break;
      }
    }
    if (rawItems) break;
  }

  const total =
    getNumber(payload.total) ??
    getNumber(data.total) ??
    getNumber(isRecord(payload.pagination) ? payload.pagination.total : null) ??
    (rawItems ? rawItems.length : null);

  return {
    items: rawItems ? rawItems.filter(isRecord) : [],
    total,
    itemsKnown: rawItems !== null,
  };
}

async function loadCollection(
  path: string,
  accessToken: string,
  keys: string[],
): Promise<LoadResult<CollectionSnapshot>> {
  try {
    const { status, payload } = await getBackendPayload(path, accessToken);
    if (status < 200 || status >= 300 || payload.ok === false) {
      return {
        state: "error",
        status,
        error: typeof payload.error === "string" ? payload.error : `Request failed (${status}).`,
      };
    }
    return { state: "ready", data: extractCollection(payload, keys) };
  } catch (error) {
    console.error(`[dashboard/overview] ${path} request failed:`, error);
    return { state: "error", error: error instanceof Error ? error.message : "Unable to load workspace data." };
  }
}

async function loadObject(
  path: string,
  accessToken: string,
  _key?: string,
): Promise<LoadResult<JsonRecord>> {
  try {
    const { status, payload } = await getBackendPayload(path, accessToken);
    if (status < 200 || status >= 300 || payload.ok !== true) {
      return {
        state: "error",
        status,
        error: typeof payload.error === "string" ? payload.error : `Request failed (${status}).`,
      };
    }
    return { state: "ready", data: payload };
  } catch (error) {
    console.error(`[dashboard/overview] ${path} request failed:`, error);
    return { state: "error", error: error instanceof Error ? error.message : "Unable to load workspace settings." };
  }
}

async function loadBusinessProfile(accessToken: string): Promise<LoadResult<JsonRecord | null>> {
  try {
    const { status, payload } = await getBackendPayload("/api/business-profile", accessToken);
    if (status === 404) return { state: "ready", data: null };
    if (status < 200 || status >= 300 || payload.ok !== true) {
      return {
        state: "error",
        status,
        error: typeof payload.error === "string" ? payload.error : `Business profile request failed (${status}).`,
      };
    }
    return { state: "ready", data: isRecord(payload.businessProfile) ? payload.businessProfile : null };
  } catch (error) {
    console.error("[dashboard/overview] Business profile request failed:", error);
    return { state: "error", error: error instanceof Error ? error.message : "Unable to load the business profile." };
  }
}

async function DashboardPageContent() {
  // Request-time work must remain beneath the Suspense boundary below.
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) redirect("/sign-in");

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) redirect("/sign-in");

  const accessToken = session.access_token;
  const [analytics, contacts, campaigns, followUps, knowledgeBase, businessProfile, agentSettings, teamMembers, clients, authProfile, launchContacts, setup] = await Promise.all([
    loadAnalytics(accessToken),
    loadCollection("/api/contacts", accessToken, ["contacts"]),
    loadCollection("/api/campaigns", accessToken, ["campaigns"]),
    loadCollection("/api/follow-ups", accessToken, ["followUps", "followups"]),
    loadCollection("/api/knowledge-base", accessToken, ["entries", "knowledgeBase", "knowledgeBaseEntries"]),
    loadBusinessProfile(accessToken),
    loadObject("/api/agent-settings", accessToken, "agentSettings"),
    loadCollection("/api/team-members", accessToken, ["members"]),
    loadCollection("/api/clients", accessToken, ["clients"]),
    loadObject("/api/auth/me", accessToken),
    loadCollection("/api/workspace-setup/eligible-contacts?limit=5000", accessToken, ["contacts"]),
    loadObject("/api/workspace-setup", accessToken, "setup"),
  ]);

  const clientRows = clients.state === "ready" ? clients.data.items : [];
  const workspaceMetadata = clientRows[0] && isRecord(clientRows[0].metadata) ? clientRows[0].metadata : {};
  const savedRoutingRules = isRecord(workspaceMetadata.routingRules) ? workspaceMetadata.routingRules : null;
  const routingRules: LoadResult<JsonRecord> = clients.state === "error"
    ? { state: "error", error: clients.error, status: clients.status }
    : { state: "ready", data: { ok: true, configured: savedRoutingRules?.configured === true, routingRules: savedRoutingRules ?? {
        callback: { enabled: true, assignToUserId: user.id, dueInMinutes: 30 },
        highInterest: { enabled: true, assignToUserId: user.id },
        humanRequested: { enabled: true, assignToUserId: user.id },
        noAnswer: { enabled: true, retryAfterMinutes: 1440, maxRetries: 2 },
      } } };

  const overview: DashboardOverviewData = {
    analytics,
    contacts,
    campaigns,
    followUps,
    knowledgeBase,
    businessProfile,
    agentSettings,
    routingRules,
    teamMembers,
    clients,
    authProfile,
    launchContacts,
    setup,
  };

  return <OverviewDashboard data={overview} />;
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center bg-[#FBF9F2]">
          <p className="font-['Space_Grotesk'] text-sm text-[#747878]">Loading your overview...</p>
        </div>
      }
    >
      <DashboardPageContent />
    </Suspense>
  );
}
