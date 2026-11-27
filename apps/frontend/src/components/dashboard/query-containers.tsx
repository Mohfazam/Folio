"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { dashboardKeys, type OverviewTimeframeKey } from "@/lib/query/keys";
import { DashboardApiError, fetchDashboardApi } from "@/lib/query/fetcher";
import { useDashboardProfile } from "@/components/dashboard/dashboard-shell";
import { AiStudioDashboard } from "@/components/dashboard/ai-studio-dashboard";
import { AnalyticsDashboard, type AnalyticsData } from "@/components/dashboard/analytics-dashboard";
import { SettingsDashboard } from "@/components/dashboard/settings-dashboard";
import {
  toCall,
  toCampaign,
  toContact,
  toFollowUp,
  toFollowUpContact,
  type CampaignRecord,
  type FollowUpContactOption,
} from "@/lib/query/normalizers";
import { sanitizeUserError } from "@/lib/utils/sanitize-error";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";
import {
  CallsDashboard,
  type CallFilters,
  type CallRecord,
} from "@/components/dashboard/calls-dashboard";
import { CampaignsDashboard } from "@/components/dashboard/campaigns-dashboard";
import {
  ContactsDashboard,
  type ContactFilters,
  type ContactRecord,
} from "@/components/dashboard/contacts-dashboard";
import {
  FollowUpsDashboard,
  type FollowUpRecord,
} from "@/components/dashboard/follow-ups-dashboard";

type JsonRecord = Record<string, unknown>;

export function CallsQueryContainer({
  filters,
  campaignId,
}: {
  filters: CallFilters;
  campaignId: string;
}) {
  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(filters.limit),
      offset: String(filters.offset),
    });
    if (campaignId) params.set("campaignId", campaignId);
    if (filters.search) params.set("search", filters.search);
    if (filters.outcome) params.set("outcome", filters.outcome);
    if (filters.sentiment) params.set("sentiment", filters.sentiment);
    if (filters.interestLevel) params.set("interestLevel", filters.interestLevel);
    if (filters.startDate) params.set("startDate", filters.startDate);
    if (filters.endDate) params.set("endDate", `${filters.endDate}T23:59:59.999Z`);
    return params.toString();
  }, [filters, campaignId]);

  const callsQuery = useQuery({
    queryKey: dashboardKeys.calls({ query: queryParams }),
    queryFn: () =>
      fetchDashboardApi<JsonRecord>(
        `/calls?${queryParams}`,
        "Unable to load calls right now. Please try again.",
      ),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  if (callsQuery.isPending && !callsQuery.data) {
    return <DashboardPageSkeleton variant="table" />;
  }

  const rows = Array.isArray(callsQuery.data?.calls) ? callsQuery.data.calls : [];
  const calls = rows.map(toCall).filter((item): item is CallRecord => item !== null);
  const total =
    typeof callsQuery.data?.total === "number" ? callsQuery.data.total : calls.length;
  const initialError =
    callsQuery.isError && !callsQuery.data
      ? sanitizeUserError(
          callsQuery.error instanceof Error ? callsQuery.error.message : null,
          "Unable to load calls right now. Please try again.",
        )
      : null;

  return (
    <CallsDashboard
      calls={calls}
      total={total}
      filters={filters}
      initialError={initialError}
    />
  );
}

export function CampaignsQueryContainer() {
  const campaignsQuery = useQuery({
    queryKey: dashboardKeys.campaigns(),
    queryFn: () =>
      fetchDashboardApi<JsonRecord>(
        "/campaigns",
        "Unable to load campaigns right now. Please try again.",
      ),
    staleTime: 45_000,
  });

  if (campaignsQuery.isPending && !campaignsQuery.data) {
    return <DashboardPageSkeleton variant="table" />;
  }

  const rows = Array.isArray(campaignsQuery.data?.campaigns)
    ? campaignsQuery.data.campaigns
    : [];
  const campaigns = rows
    .map(toCampaign)
    .filter((item): item is CampaignRecord => item !== null);
  const initialError =
    campaignsQuery.isError && !campaignsQuery.data
      ? sanitizeUserError(
          campaignsQuery.error instanceof Error ? campaignsQuery.error.message : null,
          "Unable to load campaigns right now. Please try again.",
        )
      : null;

  return (
    <CampaignsDashboard
      initialCampaigns={campaigns}
      initialError={initialError}
    />
  );
}

export function ContactsQueryContainer({
  filters,
  startInImportMode,
}: {
  filters: ContactFilters;
  startInImportMode: boolean;
}) {
  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(filters.limit),
      offset: String(filters.offset),
    });
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.lifecycleStage) params.set("lifecycleStage", filters.lifecycleStage);
    return params.toString();
  }, [filters]);

  const contactsQuery = useQuery({
    queryKey: dashboardKeys.contacts({ query: queryParams }),
    queryFn: () =>
      fetchDashboardApi<JsonRecord>(
        `/contacts?${queryParams}`,
        "Unable to load contacts right now. Please try again.",
      ),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  if (contactsQuery.isPending && !contactsQuery.data) {
    return <DashboardPageSkeleton variant="table" />;
  }

  const rows = Array.isArray(contactsQuery.data?.contacts)
    ? contactsQuery.data.contacts
    : [];
  const contacts = rows
    .map(toContact)
    .filter((item): item is ContactRecord => item !== null);
  const total =
    typeof contactsQuery.data?.total === "number"
      ? contactsQuery.data.total
      : contacts.length;
  const initialError =
    contactsQuery.isError && !contactsQuery.data
      ? sanitizeUserError(
          contactsQuery.error instanceof Error ? contactsQuery.error.message : null,
          "Unable to load contacts right now. Please try again.",
        )
      : null;

  return (
    <ContactsDashboard
      contacts={contacts}
      total={total}
      filters={filters}
      initialError={initialError}
      startInImportMode={startInImportMode}
    />
  );
}

export function FollowUpsQueryContainer({
  initialStatus,
}: {
  initialStatus: string;
}) {
  const followUpsQuery = useQuery({
    queryKey: dashboardKeys.followUps({ limit: 100, offset: 0 }),
    queryFn: () =>
      fetchDashboardApi<JsonRecord>(
        "/follow-ups?limit=100&offset=0",
        "Unable to load follow-ups right now. Please try again.",
      ),
    staleTime: 30_000,
  });

  const contactsQuery = useQuery({
    queryKey: dashboardKeys.contacts({ query: "limit=100&offset=0" }),
    queryFn: () =>
      fetchDashboardApi<JsonRecord>(
        "/contacts?limit=100&offset=0",
        "Unable to load contacts right now. Please try again.",
      ),
    staleTime: 60_000,
  });

  if (followUpsQuery.isPending && !followUpsQuery.data) {
    return <DashboardPageSkeleton variant="table" />;
  }

  const followUpRows = Array.isArray(followUpsQuery.data?.followUps)
    ? followUpsQuery.data.followUps
    : [];
  const followUps = followUpRows
    .map(toFollowUp)
    .filter((item): item is FollowUpRecord => item !== null);
  const total =
    typeof followUpsQuery.data?.total === "number"
      ? followUpsQuery.data.total
      : followUps.length;

  const contactRows = Array.isArray(contactsQuery.data?.contacts)
    ? contactsQuery.data.contacts
    : [];
  const contacts = contactRows
    .map(toFollowUpContact)
    .filter((item): item is FollowUpContactOption => item !== null);

  const initialError =
    followUpsQuery.isError && !followUpsQuery.data
      ? sanitizeUserError(
          followUpsQuery.error instanceof Error ? followUpsQuery.error.message : null,
          "Unable to load follow-ups right now. Please try again.",
        )
      : null;

  return (
    <FollowUpsDashboard
      followUps={followUps}
      total={total}
      contacts={contacts}
      initialStatus={initialStatus}
      initialError={initialError}
    />
  );
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toSettingOption(value: unknown, key: "id" | "code"): string {
  if (typeof value === "string") return value;
  if (isJsonRecord(value)) {
    const candidate = value[key];
    return typeof candidate === "string" ? candidate : "";
  }
  return "";
}

export function AiStudioQueryContainer() {
  const kbQuery = useQuery({
    queryKey: dashboardKeys.knowledgeBase(),
    queryFn: () =>
      fetchDashboardApi<JsonRecord>(
        "/knowledge-base?limit=100&offset=0",
        "Unable to load knowledge base.",
      ),
    staleTime: 60_000,
  });

  const agentQuery = useQuery({
    queryKey: dashboardKeys.agentSettings(),
    queryFn: () =>
      fetchDashboardApi<JsonRecord>(
        "/agent-settings",
        "Unable to load agent settings.",
      ),
    staleTime: 60_000,
  });

  if (
    (kbQuery.isPending && !kbQuery.data) ||
    (agentQuery.isPending && !agentQuery.data)
  ) {
    return <DashboardPageSkeleton variant="editor" />;
  }

  const entries = Array.isArray(kbQuery.data?.entries)
    ? kbQuery.data.entries.filter(isJsonRecord)
    : [];
  const agent = isJsonRecord(agentQuery.data?.agentSettings)
    ? agentQuery.data.agentSettings
    : {};
  const profile = isJsonRecord(agentQuery.data?.businessProfile)
    ? agentQuery.data.businessProfile
    : {};
  const voices = Array.isArray(agentQuery.data?.availableVoices)
    ? agentQuery.data.availableVoices
        .filter(isJsonRecord)
        .filter(
          (v): v is JsonRecord & { id: string; label: string; language?: string } =>
            typeof v.id === "string" && typeof v.label === "string",
        )
    : [];
  const defaultLanguages: Array<{ code: string; label: string }> = [
    { code: "en-IN", label: "English (India)" },
  ];
  const languages = Array.isArray(agentQuery.data?.availableLanguages)
    ? agentQuery.data.availableLanguages
        .filter(isJsonRecord)
        .filter(
          (v): v is JsonRecord & { code: string; label: string } =>
            typeof v.code === "string" && typeof v.label === "string",
        )
    : defaultLanguages;

  const kbError =
    kbQuery.isError && !kbQuery.data
      ? sanitizeUserError(
          kbQuery.error instanceof Error ? kbQuery.error.message : null,
          "Unable to load knowledge base.",
        )
      : null;
  const agentError =
    agentQuery.isError && !agentQuery.data
      ? sanitizeUserError(
          agentQuery.error instanceof Error ? agentQuery.error.message : null,
          "Unable to load agent settings.",
        )
      : null;

  return (
    <AiStudioDashboard
      entries={entries as never}
      agent={agent}
      profile={profile}
      voices={voices}
      languages={languages.length ? languages : defaultLanguages}
      error={kbError ?? agentError}
    />
  );
}

export function AnalyticsQueryContainer({
  timeframe,
}: {
  timeframe: OverviewTimeframeKey;
}) {
  const analyticsQuery = useQuery({
    queryKey: dashboardKeys.overviewAnalytics(timeframe),
    queryFn: () =>
      fetchDashboardApi<JsonRecord>(
        `/analytics/overview?timeframe=${timeframe}`,
        "Unable to load analytics right now. Please try again.",
      ),
    placeholderData: keepPreviousData,
    staleTime: 45_000,
  });

  if (analyticsQuery.isPending && !analyticsQuery.data) {
    return <DashboardPageSkeleton variant="analytics" />;
  }

  const error =
    analyticsQuery.isError && !analyticsQuery.data
      ? sanitizeUserError(
          analyticsQuery.error instanceof Error ? analyticsQuery.error.message : null,
          "Unable to load analytics right now. Please try again.",
        )
      : null;

  return (
    <AnalyticsDashboard
      timeframe={timeframe}
      data={analyticsQuery.data ? (analyticsQuery.data as unknown as AnalyticsData) : null}
      error={error}
    />
  );
}

export function SettingsQueryContainer() {
  const dashboardProfile = useDashboardProfile();

  const profileQuery = useQuery({
    queryKey: dashboardKeys.businessProfile(),
    queryFn: async () => {
      try {
        return await fetchDashboardApi<JsonRecord>(
          "/business-profile",
          "Unable to load business profile settings right now. Please try again.",
        );
      } catch (err) {
        if (err instanceof DashboardApiError && err.status === 404) {
          return { ok: true, businessProfile: null } as JsonRecord;
        }
        throw err;
      }
    },
    staleTime: 60_000,
  });

  const agentQuery = useQuery({
    queryKey: dashboardKeys.agentSettings(),
    queryFn: () =>
      fetchDashboardApi<JsonRecord>(
        "/agent-settings",
        "Unable to load AI agent settings right now. Please try again.",
      ),
    staleTime: 60_000,
  });

  // Render Settings immediately with zero skeleton delay; cached/fetched profile data hydrates seamlessly.

  const businessProfile = isJsonRecord(profileQuery.data?.businessProfile)
    ? profileQuery.data.businessProfile
    : {};
  const agentSettings = isJsonRecord(agentQuery.data?.agentSettings)
    ? agentQuery.data.agentSettings
    : {};
  const voices = Array.isArray(agentQuery.data?.availableVoices)
    ? agentQuery.data.availableVoices
        .map((item) => toSettingOption(item, "id"))
        .filter(Boolean)
    : [];
  const languages = Array.isArray(agentQuery.data?.availableLanguages)
    ? agentQuery.data.availableLanguages
        .map((item) => toSettingOption(item, "code"))
        .filter(Boolean)
    : [];

  const profileError =
    profileQuery.isError && !profileQuery.data
      ? sanitizeUserError(
          profileQuery.error instanceof Error ? profileQuery.error.message : null,
          "Unable to load business profile settings right now. Please try again.",
        )
      : null;
  const agentError =
    agentQuery.isError && !agentQuery.data
      ? sanitizeUserError(
          agentQuery.error instanceof Error ? agentQuery.error.message : null,
          "Unable to load AI agent settings right now. Please try again.",
        )
      : null;

  return (
    <SettingsDashboard
      account={{
        name: dashboardProfile.displayName ?? "",
        email: dashboardProfile.email ?? "",
      }}
      initialSettings={{
        profile: businessProfile,
        agent: agentSettings,
        voices,
        languages,
        error: profileError ?? agentError,
      }}
    />
  );
}
