import { Suspense } from "react";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";
import {
  OverviewDashboard,
  type DashboardOverviewData,
  type JsonRecord,
  type CollectionSnapshot,
} from "@/components/dashboard/overview-dashboard";

type ApiEnvelope = JsonRecord & { ok?: boolean; error?: string };

type LoadResult<T> =
  | { state: "ready"; data: T }
  | { state: "error"; error: string; status?: number };

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}


async function getBackendPayload(
  path: string,
  accessToken: string,
): Promise<{ status: number; payload: ApiEnvelope }> {
  const baseUrl = (process.env.BACKEND_API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:4000").replace(/\/+$/, "");

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


async function DashboardPageContent() {
  // Request-time work must remain beneath the Suspense boundary below.
  await connection();
  const auth = await getDashboardAuthContext();
  if (!auth) redirect("/sign-in");

  // The setup endpoint returns compact counts and readiness flags. The large
  // wizard datasets are fetched only when a user actually opens a setup step.
  const setup = await loadObject("/api/workspace-setup", auth.accessToken, "setup");

  const emptySnapshot: CollectionSnapshot = { items: [], total: null, itemsKnown: false };
  const emptyCollection: LoadResult<CollectionSnapshot> = { state: "ready", data: emptySnapshot };
  const emptyObject: LoadResult<JsonRecord> = { state: "ready", data: {} };

  const overview: DashboardOverviewData = {
    analytics: { state: "loading" },
    contacts: emptyCollection,
    campaigns: emptyCollection,
    followUps: emptyCollection,
    knowledgeBase: emptyCollection,
    businessProfile: { state: "ready", data: null },
    agentSettings: emptyObject,
    routingRules: emptyObject,
    teamMembers: emptyCollection,
    clients: emptyCollection,
    authProfile: emptyObject,
    launchContacts: emptyCollection,
    setup,
  };

  return <OverviewDashboard data={overview} />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton variant="overview" />}>
      <DashboardPageContent />
    </Suspense>
  );
}
