import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CampaignsDashboard } from "@/components/dashboard/campaigns-dashboard";

type JsonRecord = Record<string, unknown>;

type Campaign = {
  id: string;
  name: string;
  type: string;
  status: string;
  primaryObjective: string;
  createdAt: string | null;
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

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
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
    createdAt: typeof value.createdAt === "string" ? value.createdAt : null,
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

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/sign-in");

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) redirect("/sign-in");

  const baseUrl = process.env.BACKEND_API_URL?.trim().replace(/\/+$/, "");
  if (!baseUrl) {
    return <CampaignsDashboard initialCampaigns={[]} initialError="BACKEND_API_URL is not configured for the Next.js server." />;
  }

  try {
    const response = await fetch(`${baseUrl}/api/campaigns`, {
      method: "GET",
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok || !isRecord(payload) || payload.ok !== true) {
      const message = isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : `Campaign request failed (${response.status}).`;
      return <CampaignsDashboard initialCampaigns={[]} initialError={message} />;
    }

    const rows = Array.isArray(payload.campaigns) ? payload.campaigns : [];
    return <CampaignsDashboard initialCampaigns={rows.map(toCampaign).filter((item): item is Campaign => item !== null)} initialError={null} />;
  } catch (cause) {
    console.error("[dashboard/campaigns] Unable to load campaigns:", cause);
    return <CampaignsDashboard initialCampaigns={[]} initialError={cause instanceof Error ? cause.message : "Unable to load campaigns."} />;
  }
}

function CampaignsLoading() {
  return (
    <div className="space-y-6" aria-live="polite" aria-busy="true">
      <div>
        <div className="h-3 w-36 animate-pulse rounded bg-[#E9E8E1]" />
        <div className="mt-3 h-10 w-56 animate-pulse rounded bg-[#E9E8E1]" />
        <div className="mt-3 h-4 w-full max-w-[520px] animate-pulse rounded bg-[#F0EFE9]" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-[8px] border border-[#ECEBE5] bg-[#FFFEFB]"
          />
        ))}
      </div>

      <div className="h-72 animate-pulse rounded-[8px] border border-[#ECEBE5] bg-[#FFFEFB]" />
      <span className="sr-only">Loading campaigns…</span>
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={<CampaignsLoading />}>
      <CampaignsPageContent />
    </Suspense>
  );
}
