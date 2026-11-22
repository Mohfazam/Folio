import { Suspense } from "react";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";
import {
  OverviewDashboard,
  type DashboardOverviewData,
  type JsonRecord,
  type CollectionSnapshot,
} from "@/components/dashboard/overview-dashboard";

type LoadResult<T> =
  | { state: "loading" }
  | { state: "ready"; data: T }
  | { state: "error"; error: string; status?: number };

function DashboardPageContent() {
  const emptySnapshot: CollectionSnapshot = { items: [], total: null, itemsKnown: false };
  const emptyCollection: LoadResult<CollectionSnapshot> = { state: "ready", data: emptySnapshot };
  const emptyObject: LoadResult<JsonRecord> = { state: "ready", data: {} };

  // Workspace setup and analytics are loaded and cached client-side via TanStack Query
  // so navigating to and returning to /dashboard renders instantly without blocking SSR.
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
    setup: { state: "loading" },
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
