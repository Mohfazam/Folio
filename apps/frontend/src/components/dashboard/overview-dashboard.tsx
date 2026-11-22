"use client";
import { sanitizeUserError } from "@/lib/utils/sanitize-error";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useDashboardNavigation,
  useDashboardProfile,
  type DashboardSetupAction,
} from "@/components/dashboard/dashboard-shell";
import { SetupWizardModal } from "@/components/dashboard/setup-wizard-modal";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  skipTestCallSetupAction,
  type OverviewTimeframe,
} from "@/app/(dashboard)/dashboard/actions";
import { dashboardKeys } from "@/lib/query/keys";
import { fetchDashboardApi, DashboardApiError } from "@/lib/query/fetcher";
import { useDashboardUiStore } from "@/stores/dashboard-ui-store";

export type JsonRecord = Record<string, unknown>;

export type AnalyticsOverview = {
  timeframe: string;
  client: JsonRecord;
  quota: JsonRecord;
  callMetrics: JsonRecord;
  leadIntelligence: JsonRecord;
  pipeline: JsonRecord;
  costs: JsonRecord;
  recentCalls: JsonRecord[];
  dailyTrend: JsonRecord[];
  campaignPerformance: JsonRecord[];
};

export type CollectionSnapshot = {
  items: JsonRecord[];
  total: number | null;
  itemsKnown: boolean;
};

type LoadResult<T> =
  | { state: "loading" }
  | { state: "ready"; data: T }
  | { state: "error"; error: string; status?: number };

export type DashboardOverviewData = {
  analytics: LoadResult<AnalyticsOverview>;
  contacts: LoadResult<CollectionSnapshot>;
  campaigns: LoadResult<CollectionSnapshot>;
  followUps: LoadResult<CollectionSnapshot>;
  knowledgeBase: LoadResult<CollectionSnapshot>;
  businessProfile: LoadResult<JsonRecord | null>;
  agentSettings: LoadResult<JsonRecord>;
  routingRules: LoadResult<JsonRecord>;
  teamMembers: LoadResult<CollectionSnapshot>;
  clients: LoadResult<CollectionSnapshot>;
  authProfile: LoadResult<JsonRecord>;
  launchContacts: LoadResult<CollectionSnapshot>;
  setup: LoadResult<JsonRecord>;
};

type IconKind =
  | "calls"
  | "conversation"
  | "followup"
  | "queue"
  | "contacts"
  | "campaign"
  | "voice"
  | "clock"
  | "check"
  | "arrow"
  | "alert"
  | "credit"
  | "knowledge"
  | "routing"
  | "refresh"
  | "activity";

function Icon({ kind, className = "h-4 w-4" }: { kind: IconKind; className?: string }) {
  const paths: Record<IconKind, ReactNode> = {
    calls: (
      <path d="M6.5 3.5h3l1.5 4-2 1.8a15 15 0 0 0 5.7 5.7l1.8-2 4 1.5v3c0 1.1-.9 2-2 2A15.5 15.5 0 0 1 4.5 5.5c0-1.1.9-2 2-2Z" />
    ),
    conversation: (
      <>
        <path d="M4 5h16v11H9l-5 4z" />
        <path d="M8 9h8M8 12h5" />
      </>
    ),
    followup: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M7 3v4M17 3v4M3 10h18M8 14h3M8 17h6" />
      </>
    ),
    queue: (
      <>
        <path d="M4 6h16M4 12h16M4 18h10" />
        <circle cx="18" cy="18" r="2" />
      </>
    ),
    contacts: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3.2 2.6-5 6-5s6 1.8 6 5M17 5a3 3 0 0 1 0 6M18 15c2 .5 3 2 3 4" />
      </>
    ),
    campaign: (
      <>
        <path d="M3 11v2a2 2 0 0 0 2 2h2l3 5h2l-2-6" />
        <path d="M7 9 19 4v16L7 15z" />
      </>
    ),
    voice: <path d="M4 10v4M8 6v12M12 3v18M16 7v10M20 10v4" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    alert: (
      <>
        <path d="M12 3 2.8 20h18.4L12 3Z" />
        <path d="M12 9v5M12 17h.01" />
      </>
    ),
    credit: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),
    knowledge: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z" />
        <path d="M4 5.5V22M8 7h8M8 11h8" />
      </>
    ),
    routing: (
      <>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <path d="M8.5 6H14a4 4 0 0 1 4 4v5.5" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 11a8 8 0 0 0-14.5-4.5L3 9" />
        <path d="M3 4v5h5" />
        <path d="M4 13a8 8 0 0 0 14.5 4.5L21 15" />
        <path d="M21 20v-5h-5" />
      </>
    ),
    activity: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[kind]}
    </svg>
  );
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function recordText(record: JsonRecord | null | undefined, key: string): string | null {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function recordNumber(record: JsonRecord | null | undefined, key: string): number | null {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-IN") : "—";
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
}

function formatDate(value: unknown, timezone: string): string {
  if (typeof value !== "string" && !(value instanceof Date)) return "Time unavailable";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
}

function formatShortDate(value: unknown, timezone: string): string {
  if (typeof value !== "string" && !(value instanceof Date)) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: timezone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
  }
}

type SetupAction = DashboardSetupAction;

type SetupStep = {
  id: number;
  title: string;
  description: string;
  action: string;
  actionKey: SetupAction;
  complete: boolean;
  detail: string;
  recommended?: boolean;
  optional?: boolean;
  disabled?: boolean;
  disabledReason?: string;
};

type WorkspaceSetupState = {
  mandatorySteps: SetupStep[];
  allSteps: SetupStep[];
  completedMandatoryCount: number;
  totalMandatoryCount: number;
  isComplete: boolean;
  hasPartialProgress: boolean;
  nextRequiredStep: SetupStep | null;
};

function evaluateWorkspaceSetup(data: DashboardOverviewData): WorkspaceSetupState {
  const summary =
    data.setup.state === "ready" && isJsonRecord(data.setup.data.setup)
      ? data.setup.data.setup
      : null;

  const contactCount = recordNumber(summary, "contactCount");
  const campaignCount = recordNumber(summary, "campaignCount");
  const activeCampaignCount = recordNumber(summary, "activeCampaignCount");
  const testCallStatus = recordText(summary, "testCallStatus");
  const testCallOutcome = recordText(summary, "testCallOutcome");
  const testCallSkipped = summary?.testCallSkipped === true;
  const testCallComplete = summary?.testCallComplete === true;
  const agentName = recordText(summary, "agentName") ?? "your AI agent";

  const agentConfigured = summary?.agentConfigured === true;
  const contactsImported = summary?.contactsImported === true;
  const campaignCreated = summary?.campaignCreated === true;
  const routingConfigured = summary?.routingConfigured === true;
  const campaignLaunched = summary?.campaignLaunched === true;

  const rawSteps: SetupStep[] = [
    {
      id: 1,
      title: "Set up your AI agent",
      description:
        "Configure your business context, agent persona, opening greeting, and safety guardrails.",
      action: agentConfigured ? "Edit details" : "Set up voice",
      actionKey: "voice",
      complete: agentConfigured,
      detail: agentConfigured
        ? `${agentName} is configured and ready.`
        : "Add your business context, agent identity, greeting, and guardrails.",
    },
    {
      id: 2,
      title: "Import eligible contacts",
      description:
        "Upload a contact list. Invalid, duplicate, and opted-out numbers are filtered automatically.",
      action: "Import contacts",
      actionKey: "contacts",
      complete: contactsImported,
      detail:
        contactCount !== null
          ? `${formatNumber(contactCount)} eligible contacts available in this workspace.`
          : "Upload a CSV or Excel contact list.",
    },
    {
      id: 3,
      title: "Place a test call",
      description:
        "Optional: call a number you own to preview your agent live before launching to customers.",
      action: "Test call",
      actionKey: "test-call",
      complete: testCallComplete || testCallSkipped,
      optional: true,
      detail: testCallComplete
        ? "Test call connected successfully."
        : testCallSkipped
          ? "Skipped — you can still run a test call anytime."
          : testCallStatus === "pending"
            ? "Test call queued and connecting shortly."
            : testCallOutcome
              ? `Last test call ended with ${testCallOutcome.replaceAll("_", " ")}.`
              : "Optional step — skip anytime to continue setup.",
    },
    {
      id: 4,
      title: "Create your first campaign",
      description:
        "Define your outreach objective, talking points, and call-to-action in a campaign draft.",
      action: "Create campaign",
      actionKey: "campaign",
      complete: campaignCreated,
      detail:
        campaignCount !== null
          ? `${formatNumber(campaignCount)} campaign${campaignCount === 1 ? "" : "s"} created in this workspace.`
          : "Create and save your first campaign draft.",
    },
    {
      id: 5,
      title: "Configure follow-up routing & hours",
      description:
        "Assign callback ownership, no-answer retry cadences, and compliant local calling hours.",
      action: "Configure routing",
      actionKey: "routing",
      complete: routingConfigured,
      detail: routingConfigured
        ? "Follow-up routing and local calling hours are configured."
        : "Set callback ownership, retry limits, and calling hours.",
    },
    {
      id: 6,
      title: "Review and launch campaign",
      description:
        "Select eligible contacts, review your script, and approve your first outbound run.",
      action: "Launch campaign",
      actionKey: "launch",
      complete: campaignLaunched,
      detail: campaignLaunched
        ? "Your first campaign has been approved for outbound calling."
        : activeCampaignCount !== null
          ? `${formatNumber(activeCampaignCount)} active campaigns currently running.`
          : "Review your audience and approve launch.",
    },
  ];

  const requiredBeforeLaunchComplete =
    agentConfigured && contactsImported && campaignCreated && routingConfigured;

  const firstIncompleteMandatory =
    rawSteps.find((step) => !step.optional && !step.complete) ?? null;

  const allSteps = rawSteps.map((step) => {
    const recommended =
      !step.complete && firstIncompleteMandatory !== null && step.id === firstIncompleteMandatory.id;
    if (step.actionKey === "test-call" && !(agentConfigured && contactsImported)) {
      return {
        ...step,
        recommended,
        disabled: true,
        disabledReason: "Set up your AI agent and import contacts first.",
      };
    }
    if (step.actionKey === "launch" && !requiredBeforeLaunchComplete) {
      return {
        ...step,
        recommended,
        disabled: true,
        disabledReason: "Complete the required setup steps above before launching.",
      };
    }
    return { ...step, recommended };
  });

  const mandatorySteps = allSteps.filter((step) => !step.optional);
  const completedMandatoryCount = mandatorySteps.filter((step) => step.complete).length;
  const totalMandatoryCount = mandatorySteps.length;
  const isComplete =
    data.setup.state === "ready" &&
    totalMandatoryCount > 0 &&
    completedMandatoryCount === totalMandatoryCount;

  const hasPartialProgress =
    !isComplete &&
    (completedMandatoryCount > 0 || testCallComplete || testCallSkipped);

  return {
    mandatorySteps,
    allSteps,
    completedMandatoryCount,
    totalMandatoryCount,
    isComplete,
    hasPartialProgress,
    nextRequiredStep: firstIncompleteMandatory,
  };
}

function SectionError({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: string;
  onRetry?: () => void;
}) {
  const safeError = sanitizeUserError(
    error,
    "A temporary connection issue prevented loading this section. Please retry.",
  );

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#F0D8D4] bg-[#FFF9F8] px-4 py-3"
    >
      <div className="min-w-0">
        <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#8D3028]">
          {title} could not be loaded
        </p>
        <p className="mt-0.5 break-words font-['Space_Grotesk'] text-[11px] leading-5 text-[#8D5A55]">
          {safeError}
        </p>
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] border border-[#E5C4BF] bg-white px-3 font-['Space_Grotesk'] text-[11px] font-semibold text-[#8D3028] transition-colors hover:bg-[#FDF2F1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
        >
          <Icon kind="refresh" className="h-3.5 w-3.5" />
          Retry
        </button>
      ) : null}
    </div>
  );
}

function ProgressRing({ complete, total }: { complete: number; total: number }) {
  const percentage = total > 0 ? Math.min(100, Math.round((complete / total) * 100)) : 0;
  return (
    <div
      className="relative flex h-13 w-13 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#644ABB ${percentage * 3.6}deg, #E9E8E1 0deg)` }}
      role="img"
      aria-label={`${complete} of ${total} required setup steps complete (${percentage}%)`}
    >
      <div className="absolute inset-[4px] flex items-center justify-center rounded-full bg-[#F8F7F2] font-['Space_Grotesk'] text-[11px] font-bold tracking-[0.04em] text-[#1B1C18]">
        {complete}/{total}
      </div>
    </div>
  );
}

function SetupChecklist({
  setupState,
  setupError,
  onRetrySetup,
  onAction,
}: {
  setupState: WorkspaceSetupState;
  setupError: string | null;
  onRetrySetup?: () => void;
  onAction: (action: SetupAction) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { allSteps, mandatorySteps, completedMandatoryCount, totalMandatoryCount, hasPartialProgress } =
    setupState;

  const visibleSteps = useMemo(() => {
    if (!hasPartialProgress) return allSteps;
    return allSteps.filter((step) => !(step.optional && step.complete));
  }, [allSteps, hasPartialProgress]);

  const [expandedId, setExpandedId] = useState<number | null>(
    setupState.nextRequiredStep?.id ?? visibleSteps[0]?.id ?? null,
  );
  const [skippingTestCall, setSkippingTestCall] = useState(false);
  const [skipTestCallError, setSkipTestCallError] = useState<string | null>(null);

  useEffect(() => {
    setExpandedId(setupState.nextRequiredStep?.id ?? null);
  }, [setupState.nextRequiredStep?.id]);

  const progressPercent =
    totalMandatoryCount > 0
      ? Math.round((completedMandatoryCount / totalMandatoryCount) * 100)
      : 0;

  const handleSkipTestCall = async () => {
    if (skippingTestCall) return;
    setSkippingTestCall(true);
    setSkipTestCallError(null);
    try {
      const result = await skipTestCallSetupAction();
      if (!result.ok) {
        setSkipTestCallError(result.error);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.workspaceSetup() });
      router.refresh();
    } catch (error) {
      setSkipTestCallError(
        error instanceof Error ? error.message : "Unable to skip the test-call step.",
      );
    } finally {
      setSkippingTestCall(false);
    }
  };

  return (
    <div className="space-y-3">
      {setupError ? <SectionError title="Workspace setup status" error={setupError} onRetry={onRetrySetup} /> : null}
      <section
        className="overflow-hidden rounded-[12px] border border-[#E9E8E1] bg-white shadow-[0_1px_2px_rgba(27,28,24,0.04)]"
        aria-labelledby="setup-heading"
      >
        <div className="flex flex-col gap-3 border-b border-[#ECEBE5] bg-[#F8F7F2] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <ProgressRing complete={completedMandatoryCount} total={totalMandatoryCount} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id="setup-heading"
                  className="font-['Space_Grotesk'] text-[15px] font-semibold tracking-[-0.01em] text-[#1B1C18]"
                >
                  {hasPartialProgress
                    ? "Finish setting up your workspace"
                    : "Get your workspace ready for outbound voice"}
                </h2>
                <span className="rounded-full bg-[#E7DEFF] px-2.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold text-[#644ABB]">
                  {progressPercent}% required complete
                </span>
              </div>
              <p className="mt-0.5 font-['Space_Grotesk'] text-[12px] text-[#565B5B]">
                {mandatorySteps.length - completedMandatoryCount} required{" "}
                {mandatorySteps.length - completedMandatoryCount === 1 ? "step" : "steps"} remaining
                to launch outbound campaigns.
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-[#ECEBE5] px-4 py-1 sm:px-5">
          {visibleSteps.map((step) => {
            const isExpanded = expandedId === step.id;
            const statusLabel = step.complete
              ? "Completed"
              : step.disabled
                ? "Blocked"
                : step.optional
                  ? "Optional"
                  : step.recommended
                    ? "Next step"
                    : "Pending";

            return (
              <article
                key={step.id}
                className={`py-3 transition-colors ${
                  step.recommended ? "-mx-2 my-1 rounded-[8px] bg-[#F8F7F2] px-3" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      step.complete
                        ? "border-[#6BA77A] bg-[#E8F3EA] text-[#25633A]"
                        : step.recommended
                          ? "border-[#644ABB] bg-[#F0EAFB] text-[#644ABB]"
                          : "border-[#D5D5CE] bg-white text-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    {step.complete ? (
                      <Icon kind="check" className="h-3 w-3" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : step.id)}
                      aria-expanded={isExpanded}
                      className="flex w-full flex-wrap items-center gap-2 rounded-[4px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
                    >
                      <span
                        className={`font-['Space_Grotesk'] text-[14px] font-semibold ${
                          step.complete ? "text-[#565B5B]" : "text-[#1B1C18]"
                        }`}
                      >
                        {step.title}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold ${
                          step.complete
                            ? "bg-[#EFF8F1] text-[#34734B]"
                            : step.disabled
                              ? "bg-[#F1F0EB] text-[#747878]"
                              : step.optional
                                ? "bg-[#F7F5EF] text-[#696B62]"
                                : step.recommended
                                  ? "bg-[#E7DEFF] text-[#644ABB]"
                                  : "bg-[#FFFAEC] text-[#8A6826]"
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </button>

                    {isExpanded ? (
                      <div className="mt-1.5 space-y-1">
                        <p className="max-w-[620px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#565B5B]">
                          {step.description}
                        </p>
                        <p className="font-['Space_Grotesk'] text-[11px] text-[#747878]">
                          {step.disabled && step.disabledReason ? step.disabledReason : step.detail}
                        </p>
                        {step.actionKey === "test-call" && skipTestCallError ? (
                          <p role="alert" className="font-['Space_Grotesk'] text-[11px] text-[#A33A32]">
                            {skipTestCallError}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onAction(step.actionKey)}
                      disabled={step.disabled}
                      title={step.disabled ? step.disabledReason : undefined}
                      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] px-3 font-['Space_Grotesk'] text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] disabled:cursor-not-allowed disabled:bg-[#F1F0EB] disabled:text-[#929493] ${
                        step.recommended
                          ? "bg-[#1B1C18] text-white hover:bg-[#34352F]"
                          : "border border-[#DCDDD6] bg-white text-[#1B1C18] hover:bg-[#F5F4ED]"
                      }`}
                    >
                      <span>{step.action}</span>
                      {!step.disabled ? <Icon kind="arrow" className="h-3 w-3" /> : null}
                    </button>
                    {step.actionKey === "test-call" && !step.complete ? (
                      <button
                        type="button"
                        onClick={handleSkipTestCall}
                        disabled={skippingTestCall}
                        className="inline-flex h-8 shrink-0 items-center justify-center rounded-[6px] border border-[#DCDDD6] bg-white px-2.5 font-['Space_Grotesk'] text-[12px] font-medium text-[#565B5B] transition-colors hover:bg-[#F5F4ED] disabled:opacity-60"
                      >
                        {skippingTestCall ? "Skipping…" : "Skip"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

type ActionPriority = "critical" | "important" | "recommended" | "informational";

type WorkspaceActionItem = {
  id: string;
  priority: ActionPriority;
  title: string;
  description: string;
  ctaLabel: string;
  icon: IconKind;
  onTrigger: () => void;
};

const PRIORITY_STYLES: Record<ActionPriority, { label: string; badge: string; iconBg: string }> = {
  critical: {
    label: "Critical",
    badge: "border-[#F0D8D4] bg-[#FFF8F7] text-[#A33A32]",
    iconBg: "bg-[#FBE8E6] text-[#A33A32]",
  },
  important: {
    label: "Important",
    badge: "border-[#F0DFB8] bg-[#FFFAEC] text-[#8A6826]",
    iconBg: "bg-[#F8EED8] text-[#8A6826]",
  },
  recommended: {
    label: "Recommended",
    badge: "border-[#E2D9F8] bg-[#F7F4FC] text-[#644ABB]",
    iconBg: "bg-[#EFEAFB] text-[#644ABB]",
  },
  informational: {
    label: "Info",
    badge: "border-[#E5E1D5] bg-[#F7F5EF] text-[#565B5B]",
    iconBg: "bg-[#F1F0EB] text-[#565B5B]",
  },
};

function ActionCenter({
  items,
  loading,
}: {
  items: WorkspaceActionItem[];
  loading: boolean;
}) {
  const visibleItems = items.slice(0, 4);

  return (
    <section
      className="rounded-[12px] border border-[#E9E8E1] bg-white p-5 shadow-[0_1px_2px_rgba(27,28,24,0.04)]"
      aria-labelledby="action-center-heading"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.08em] text-[#747878]">
            ACTION CENTER
          </p>
          <h2
            id="action-center-heading"
            className="mt-1 font-['Newsreader'] text-[21px] font-semibold leading-tight text-[#1B1C18]"
          >
            Recommended next actions
          </h2>
        </div>
        {visibleItems.length > 0 ? (
          <span className="rounded-full bg-[#F5F4ED] px-2.5 py-1 font-['Space_Grotesk'] text-[11px] font-semibold text-[#444748]">
            {visibleItems.length} {visibleItems.length === 1 ? "item" : "items"}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-4 space-y-2.5" aria-busy="true">
          {[0, 1].map((row) => (
            <div
              key={row}
              className="flex items-center justify-between gap-3 rounded-[8px] border border-[#ECEBE5] p-3.5"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 animate-pulse motion-reduce:animate-none rounded-[6px] bg-[#ECEBE5]" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-44 animate-pulse motion-reduce:animate-none rounded bg-[#ECEBE5]" />
                  <div className="h-2.5 w-64 animate-pulse motion-reduce:animate-none rounded bg-[#F1F0EB]" />
                </div>
              </div>
              <div className="h-8 w-24 animate-pulse motion-reduce:animate-none rounded-[6px] bg-[#ECEBE5]" />
            </div>
          ))}
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="mt-4 flex items-center gap-3 rounded-[8px] border border-[#ECEBE5] bg-[#FAF9F5] px-4 py-3.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFF8F1] text-[#34734B]">
            <Icon kind="check" className="h-4 w-4" />
          </span>
          <div>
            <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
              You&apos;re all caught up.
            </p>
            <p className="font-['Space_Grotesk'] text-[11px] text-[#666A68]">
              No urgent configuration gaps, credit warnings, or unlaunched drafts require attention.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 divide-y divide-[#ECEBE5] rounded-[8px] border border-[#ECEBE5]">
          {visibleItems.map((item) => {
            const tone = PRIORITY_STYLES[item.priority];
            return (
              <div
                key={item.id}
                className="flex flex-col gap-3 p-3.5 transition-colors hover:bg-[#FAF9F5] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] ${tone.iconBg}`}
                  >
                    <Icon kind={item.icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                        {item.title}
                      </p>
                      <span
                        className={`rounded-full border px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold leading-none ${tone.badge}`}
                      >
                        {tone.label}
                      </span>
                    </div>
                    <p className="mt-0.5 font-['Space_Grotesk'] text-[12px] leading-5 text-[#565B5B]">
                      {item.description}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={item.onTrigger}
                  className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 self-start rounded-[6px] border border-[#DCDDD6] bg-white px-3 font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18] transition-colors hover:border-[#C5C6BE] hover:bg-[#F5F4ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] sm:self-center"
                >
                  <span>{item.ctaLabel}</span>
                  <Icon kind="arrow" className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function MetricCard({
  label,
  value,
  subtext,
  badge,
  icon,
  href,
}: {
  label: string;
  value: string;
  subtext: string;
  badge?: string;
  icon: IconKind;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[126px] flex-col justify-between rounded-[12px] border border-[#E9E8E1] bg-[#FAF9F4] p-4 shadow-[0_1px_2px_rgba(27,28,24,0.03)] transition-all hover:border-[#D3D1C7] hover:bg-[#F5F4ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] sm:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-['Space_Grotesk'] text-[12px] font-medium text-[#444748] sm:text-[13px]">
          {label}
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-white text-[#565B5B] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors group-hover:text-[#644ABB]">
          <Icon kind={icon} className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline gap-2">
          <p className="font-['Newsreader'] text-[30px] leading-none tracking-[-0.4px] text-[#1B1C18]">
            {value}
          </p>
          {badge ? (
            <span className="rounded-full bg-[#EFEAFB] px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold text-[#644ABB]">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 flex items-center justify-between gap-2 font-['Space_Grotesk'] text-[11px] text-[#666A68]">
          <span className="truncate">{subtext}</span>
          <span className="shrink-0 text-[#747878] opacity-0 transition-opacity group-hover:opacity-100">
            View →
          </span>
        </p>
      </div>
    </Link>
  );
}

function PerformanceAnalytics({
  analytics,
  timeframeLabel,
  onPlaceTestCall,
  canPlaceTestCall,
}: {
  analytics: AnalyticsOverview;
  timeframeLabel: string;
  onPlaceTestCall: () => void;
  canPlaceTestCall: boolean;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const metrics = analytics.callMetrics;
  const totalCalls = recordNumber(metrics, "totalCalls") ?? 0;
  const connectedCalls = recordNumber(metrics, "connectedCalls") ?? 0;
  const unansweredCalls = recordNumber(metrics, "unansweredCalls") ?? 0;
  const droppedEarlyCalls = recordNumber(metrics, "droppedEarlyCalls") ?? 0;
  const failedCalls = recordNumber(metrics, "failedCalls") ?? 0;
  const avgDuration = recordNumber(metrics, "avgDurationSeconds") ?? 0;

  const trendSlice = useMemo(() => analytics.dailyTrend.slice(-14), [analytics.dailyTrend]);
  const maxDailyTotal = useMemo(
    () => Math.max(1, ...trendSlice.map((row) => recordNumber(row, "totalCalls") ?? 0)),
    [trendSlice],
  );

  const outcomeRows = [
    { label: "Connected", count: connectedCalls, color: "bg-[#4D9469]" },
    { label: "No answer / busy", count: unansweredCalls, color: "bg-[#D7A64A]" },
    { label: "Dropped early", count: droppedEarlyCalls, color: "bg-[#8B8D88]" },
    { label: "Failed", count: failedCalls, color: "bg-[#C66C5C]" },
  ];

  const activePoint = hoveredIdx !== null ? trendSlice[hoveredIdx] ?? null : null;

  return (
    <section
      className="rounded-[12px] border border-[#E9E8E1] bg-white p-5 shadow-[0_1px_2px_rgba(27,28,24,0.04)]"
      aria-labelledby="performance-analytics-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.08em] text-[#747878]">
            PERFORMANCE ANALYTICS
          </p>
          <h2
            id="performance-analytics-heading"
            className="mt-1 font-['Newsreader'] text-[21px] font-semibold leading-tight text-[#1B1C18]"
          >
            Call activity & outcomes
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[#F5F4ED] px-2.5 py-1 font-['Space_Grotesk'] text-[10px] font-semibold text-[#565B5B]">
            Avg talk: {totalCalls > 0 ? formatDuration(avgDuration) : "—"}
          </span>
          <Link
            href="/dashboard/analytics"
            className="rounded font-['Space_Grotesk'] text-[12px] font-semibold text-[#644ABB] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
          >
            Full analytics →
          </Link>
        </div>
      </div>

      {totalCalls === 0 && trendSlice.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-[10px] border border-dashed border-[#DFDDD4] bg-[#FAF9F5] px-5 py-8 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EFEAFB] text-[#644ABB]">
            <Icon kind="activity" className="h-5 w-5" />
          </span>
          <p className="mt-3 font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
            Performance insights will appear after your first calls
          </p>
          <p className="mt-1 max-w-[360px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#666A68]">
            No calls were recorded during {timeframeLabel.toLowerCase()}. Place a test call or launch
            a campaign to populate daily trends and outcome breakdowns.
          </p>
          {canPlaceTestCall ? (
            <button
              type="button"
              onClick={onPlaceTestCall}
              className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-[#1B1C18] px-3.5 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F]"
            >
              Make a test call
              <Icon kind="arrow" className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-6 xl:grid-cols-[1.45fr_1fr]">
          <div className="flex flex-col justify-between rounded-[10px] border border-[#ECEBE5] bg-[#FCFBF8] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">
                Daily call volume
              </p>
              {activePoint ? (
                <p className="font-['Space_Grotesk'] text-[11px] font-medium text-[#644ABB]">
                  {String(activePoint.date ?? "")}: {recordNumber(activePoint, "totalCalls") ?? 0}{" "}
                  total · {recordNumber(activePoint, "connectedCalls") ?? 0} connected
                </p>
              ) : (
                <div className="flex items-center gap-3 font-['Space_Grotesk'] text-[10px] text-[#666A68]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-xs bg-[#DFD6F7]" />
                    Total
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-xs bg-[#644ABB]" />
                    Connected
                  </span>
                </div>
              )}
            </div>

            {trendSlice.length === 0 ? (
              <div className="flex h-40 items-center justify-center font-['Space_Grotesk'] text-[12px] text-[#747878]">
                No daily trend points in this range.
              </div>
            ) : (
              <div
                className="mt-4 flex h-40 items-end gap-1.5 border-b border-[#E6E5DD] px-1 pb-1"
                role="img"
                aria-label="Bar chart showing daily total calls and connected calls"
              >
                {trendSlice.map((row, idx) => {
                  const dayTotal = recordNumber(row, "totalCalls") ?? 0;
                  const dayConnected = recordNumber(row, "connectedCalls") ?? 0;
                  const totalHeightPct = Math.max(6, Math.round((dayTotal / maxDailyTotal) * 100));
                  const connectedRatioPct =
                    dayTotal > 0 ? Math.min(100, Math.round((dayConnected / dayTotal) * 100)) : 0;
                  const dateStr = typeof row.date === "string" ? row.date : "";
                  const parsed = dateStr ? new Date(`${dateStr}T00:00:00`) : null;
                  const shortDay =
                    parsed && Number.isFinite(parsed.getTime())
                      ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(
                          parsed,
                        )
                      : dateStr;

                  return (
                    <button
                      key={`${dateStr}-${idx}`}
                      type="button"
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                      onFocus={() => setHoveredIdx(idx)}
                      onBlur={() => setHoveredIdx(null)}
                      aria-label={`${shortDay}: ${dayTotal} total calls, ${dayConnected} connected`}
                      className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end focus-visible:outline-none"
                    >
                      <div
                        className="relative w-full max-w-[26px] overflow-hidden rounded-t-[4px] bg-[#E5DDFB] transition-opacity group-hover:opacity-90"
                        style={{ height: `${totalHeightPct}%` }}
                      >
                        <div
                          className="absolute inset-x-0 bottom-0 rounded-t-[4px] bg-[#644ABB]"
                          style={{ height: `${connectedRatioPct}%` }}
                        />
                      </div>
                      <span className="mt-1.5 truncate font-['Space_Grotesk'] text-[9px] text-[#747878]">
                        {trendSlice.length <= 7 || idx % 2 === 0 ? shortDay : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between rounded-[10px] border border-[#ECEBE5] bg-[#FCFBF8] p-4">
            <div>
              <p className="font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18]">
                Outcome breakdown
              </p>
              <p className="mt-0.5 font-['Space_Grotesk'] text-[11px] text-[#666A68]">
                Distribution across {formatNumber(totalCalls)} calls
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {outcomeRows.map((row) => {
                const pct = totalCalls > 0 ? Math.round((row.count / totalCalls) * 100) : 0;
                return (
                  <div key={row.label}>
                    <div className="flex items-center justify-between gap-2 font-['Space_Grotesk'] text-[11px]">
                      <span className="text-[#444748]">{row.label}</span>
                      <span className="font-semibold tabular-nums text-[#1B1C18]">
                        {formatNumber(row.count)}{" "}
                        <span className="font-normal text-[#747878]">({pct}%)</span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#ECEBE5]">
                      <div
                        className={`h-full rounded-full ${row.color}`}
                        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function QuotaPanel({
  analytics,
  timezone,
  isTrial,
  trialEndsAt,
  onUpgrade,
}: {
  analytics: AnalyticsOverview;
  timezone: string;
  isTrial: boolean;
  trialEndsAt: string | null;
  onUpgrade: () => void;
}) {
  const allowance = Math.max(0, recordNumber(analytics.quota, "monthlyCreditsAllowance") ?? 0);
  const used = Math.max(0, recordNumber(analytics.quota, "creditsUsedThisCycle") ?? 0);
  const reserved = Math.max(0, recordNumber(analytics.quota, "creditsReservedThisCycle") ?? 0);
  const remaining = Math.max(0, recordNumber(analytics.quota, "creditsRemaining") ?? 0);
  const maxCallsPerDay = Math.max(0, recordNumber(analytics.quota, "maxCallsPerDay") ?? 0);
  const callsRemainingToday = Math.max(
    0,
    recordNumber(analytics.quota, "callsRemainingToday") ?? 0,
  );
  const resetDate = analytics.quota.nextBillingResetAt;

  const consumedAndReserved = used + reserved;
  const usedPercent =
    allowance > 0 ? Math.min(100, Math.max(0, Math.round((consumedAndReserved / allowance) * 100))) : 0;
  const remainingRatio = allowance > 0 ? remaining / allowance : 0;

  const statusTone =
    allowance > 0 && remaining === 0
      ? {
          label: "Exhausted",
          badge: "bg-[#FBE8E6] text-[#A33A32]",
          showUpgrade: true,
        }
      : allowance > 0 && remainingRatio <= 0.2
        ? {
            label: "Low balance",
            badge: "bg-[#FFFAEC] text-[#8A6826]",
            showUpgrade: true,
          }
        : null;

  return (
    <section
      className="rounded-[12px] border border-[#E9E8E1] bg-white p-5 shadow-[0_1px_2px_rgba(27,28,24,0.04)]"
      aria-labelledby="quota-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.08em] text-[#747878]">
            VOICE CREDITS & USAGE
          </p>
          <h2
            id="quota-heading"
            className="mt-1 font-['Newsreader'] text-[21px] font-semibold leading-tight text-[#1B1C18]"
          >
            Voice capacity
          </h2>
        </div>
        {statusTone ? (
          <span
            className={`rounded-full px-2.5 py-1 font-['Space_Grotesk'] text-[10px] font-semibold ${statusTone.badge}`}
          >
            {statusTone.label}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <div>
          <p className="font-['Newsreader'] text-[32px] leading-none text-[#1B1C18]">
            {formatNumber(remaining)}
          </p>
          <p className="mt-1 font-['Space_Grotesk'] text-[11px] text-[#666A68]">
            {isTrial
              ? `credits remaining of ${formatNumber(allowance)} trial allowance`
              : `credits remaining of ${formatNumber(allowance)} monthly allowance`}
          </p>
        </div>
        <span className="font-['Space_Grotesk'] text-[12px] font-semibold tabular-nums text-[#444748]">
          {usedPercent}% used
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2.5 rounded-[8px] border border-[#ECEBE5] bg-[#FAF9F5] p-3 font-['Space_Grotesk']">
        <div>
          <dt className="text-[10px] font-medium text-[#747878]">Consumed</dt>
          <dd className="mt-0.5 text-[12px] font-semibold tabular-nums text-[#1B1C18]">
            {formatNumber(used)} credits
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium text-[#747878]">Reserved in queue</dt>
          <dd className="mt-0.5 text-[12px] font-semibold tabular-nums text-[#1B1C18]">
            {formatNumber(reserved)} credits
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium text-[#747878]">Daily call capacity</dt>
          <dd className="mt-0.5 text-[12px] font-semibold tabular-nums text-[#1B1C18]">
            {formatNumber(callsRemainingToday)} / {formatNumber(maxCallsPerDay)} left
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-medium text-[#747878]">
            {isTrial ? "Trial period" : "Cycle reset"}
          </dt>
          <dd className="mt-0.5 truncate text-[12px] font-semibold text-[#1B1C18]">
            {isTrial
              ? trialEndsAt
                ? `Ends ${formatShortDate(trialEndsAt, timezone)}`
                : "7-day trial"
              : resetDate
                ? formatShortDate(resetDate, timezone)
                : "Billing cycle"}
          </dd>
        </div>
      </dl>

      <div className="mt-3.5 flex items-center justify-between gap-2">
        <Link
          href="/dashboard/analytics"
          className="font-['Space_Grotesk'] text-[11px] font-semibold text-[#565B5B] hover:text-[#1B1C18] hover:underline"
        >
          View usage breakdown
        </Link>
        {statusTone?.showUpgrade ? (
          <button
            type="button"
            onClick={onUpgrade}
            className="inline-flex h-7 items-center rounded-[6px] bg-[#644ABB] px-2.5 font-['Space_Grotesk'] text-[11px] font-semibold text-white transition-colors hover:bg-[#523AA3]"
          >
            Add credits
          </button>
        ) : null}
      </div>
    </section>
  );
}

type HealthBadgeTone = "operational" | "attention" | "unconfigured" | "inactive";

const HEALTH_TONE_CLASSES: Record<HealthBadgeTone, string> = {
  operational: "border-[#CDE5D4] bg-[#EFF8F1] text-[#34734B]",
  attention: "border-[#F0DFB8] bg-[#FFFAEC] text-[#8A6826]",
  unconfigured: "border-[#E5E1D5] bg-[#F7F5EF] text-[#696B62]",
  inactive: "border-[#F0D8D4] bg-[#FFF8F7] text-[#A33A32]",
};

function WorkspaceHealth({
  data,
  workspaceStatus,
  onRetrySetup,
  onOpenRouting,
}: {
  data: DashboardOverviewData;
  workspaceStatus: string | null;
  onRetrySetup?: () => void;
  onOpenRouting: () => void;
}) {
  const setupSummary =
    data.setup.state === "ready" && isJsonRecord(data.setup.data.setup)
      ? data.setup.data.setup
      : null;

  const agentConfigured = setupSummary?.agentConfigured === true;
  const agentName = recordText(setupSummary, "agentName");
  const contactCount = recordNumber(setupSummary, "contactCount") ?? 0;
  const campaignCount = recordNumber(setupSummary, "campaignCount") ?? 0;
  const activeCampaignCount = recordNumber(setupSummary, "activeCampaignCount") ?? 0;
  const knowledgeBaseCount = recordNumber(setupSummary, "knowledgeBaseCount") ?? 0;
  const routingConfigured = setupSummary?.routingConfigured === true;
  const isSuspended = workspaceStatus === "suspended" || workspaceStatus === "paused";

  const rows: Array<{
    key: string;
    label: string;
    meta: string;
    statusLabel: string;
    tone: HealthBadgeTone;
    href?: string;
    onClick?: () => void;
  }> = [
    {
      key: "agent",
      label: "AI Agent",
      meta: agentConfigured ? `${agentName ?? "Persona"} · Required` : "Required for calling",
      statusLabel: isSuspended ? "Inactive" : agentConfigured ? "Operational" : "Not configured",
      tone: isSuspended ? "inactive" : agentConfigured ? "operational" : "unconfigured",
      href: "/dashboard/ai-studio?tab=agent",
    },
    {
      key: "contacts",
      label: "Contacts",
      meta: `${formatNumber(contactCount)} eligible · Required`,
      statusLabel: contactCount > 0 ? "Operational" : "Not configured",
      tone: contactCount > 0 ? "operational" : "unconfigured",
      href: "/dashboard/contacts",
    },
    {
      key: "campaigns",
      label: "Campaigns",
      meta:
        campaignCount > 0
          ? `${formatNumber(activeCampaignCount)} active · ${formatNumber(campaignCount)} total`
          : "Required for outreach",
      statusLabel:
        activeCampaignCount > 0
          ? "Operational"
          : campaignCount > 0
            ? "Needs attention"
            : "Not configured",
      tone:
        activeCampaignCount > 0
          ? "operational"
          : campaignCount > 0
            ? "attention"
            : "unconfigured",
      href: "/dashboard/campaigns",
    },
    {
      key: "routing",
      label: "Follow-up Routing",
      meta: "Callbacks & calling hours · Required",
      statusLabel: routingConfigured ? "Operational" : "Not configured",
      tone: routingConfigured ? "operational" : "unconfigured",
      onClick: onOpenRouting,
    },
    {
      key: "kb",
      label: "Knowledge Base",
      meta:
        knowledgeBaseCount > 0
          ? `${formatNumber(knowledgeBaseCount)} active entries · Optional`
          : "Optional context for Q&A",
      statusLabel: knowledgeBaseCount > 0 ? "Operational" : "Not configured",
      tone: knowledgeBaseCount > 0 ? "operational" : "unconfigured",
      href: "/dashboard/ai-studio",
    },
  ];

  return (
    <section
      className="rounded-[12px] border border-[#E9E8E1] bg-white p-5 shadow-[0_1px_2px_rgba(27,28,24,0.04)]"
      aria-labelledby="workspace-health-heading"
    >
      <div>
        <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.08em] text-[#747878]">
          OPERATIONAL READINESS
        </p>
        <h2
          id="workspace-health-heading"
          className="mt-1 font-['Newsreader'] text-[21px] font-semibold leading-tight text-[#1B1C18]"
        >
          Workspace health
        </h2>
      </div>

      {data.setup.state === "error" ? (
        <div className="mt-3">
          <SectionError title="Workspace health" error={data.setup.error} onRetry={onRetrySetup} />
        </div>
      ) : (
        <div className="mt-3 divide-y divide-[#ECEBE5]">
          {rows.map((row) => {
            const inner = (
              <>
                <div className="min-w-0">
                  <p className="font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18] group-hover:text-[#644ABB]">
                    {row.label}
                  </p>
                  <p className="truncate font-['Space_Grotesk'] text-[11px] text-[#747878]">
                    {row.meta}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold ${HEALTH_TONE_CLASSES[row.tone]}`}
                >
                  {row.statusLabel}
                </span>
              </>
            );

            if (row.href) {
              return (
                <Link
                  key={row.key}
                  href={row.href}
                  className="group -mx-2 flex items-center justify-between gap-3 rounded-[6px] px-2 py-3 transition-colors hover:bg-[#FAF9F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
                >
                  {inner}
                </Link>
              );
            }

            return (
              <button
                key={row.key}
                type="button"
                onClick={row.onClick}
                className="group -mx-2 flex w-full items-center justify-between gap-3 rounded-[6px] px-2 py-3 text-left transition-colors hover:bg-[#FAF9F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
              >
                {inner}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

const OUTCOME_BADGE: Record<string, { label: string; tone: string }> = {
  connected: { label: "Connected", tone: "border-[#CDE5D4] bg-[#EFF8F1] text-[#34734B]" },
  no_answer: { label: "No answer", tone: "border-[#E5E1D5] bg-[#F7F5EF] text-[#696B62]" },
  busy: { label: "Busy", tone: "border-[#F0DFB8] bg-[#FFFAEC] text-[#8A6826]" },
  voicemail: { label: "Voicemail", tone: "border-[#D9DDE7] bg-[#F2F4F8] text-[#59647C]" },
  dropped_early: { label: "Dropped early", tone: "border-[#F0DFB8] bg-[#FFFAEC] text-[#8A6826]" },
  failed: { label: "Failed", tone: "border-[#F0D8D4] bg-[#FFF8F7] text-[#A33A32]" },
};

function RecentCalls({
  analytics,
  timezone,
  onPlaceTestCall,
  canPlaceTestCall,
}: {
  analytics: AnalyticsOverview;
  timezone: string;
  onPlaceTestCall: () => void;
  canPlaceTestCall: boolean;
}) {
  const recentCalls = analytics.recentCalls.slice(0, 5);

  return (
    <section
      className="rounded-[12px] border border-[#E9E8E1] bg-white shadow-[0_1px_2px_rgba(27,28,24,0.04)]"
      aria-labelledby="recent-calls-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ECEBE5] px-5 py-4">
        <div>
          <p className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.08em] text-[#747878]">
            RECENT ACTIVITY
          </p>
          <h2
            id="recent-calls-heading"
            className="mt-1 font-['Newsreader'] text-[21px] font-semibold leading-tight text-[#1B1C18]"
          >
            Recent calls
          </h2>
        </div>
        <Link
          href="/dashboard/calls"
          className="inline-flex h-8 items-center gap-1.5 rounded-[6px] border border-[#DCDDD6] bg-white px-3 font-['Space_Grotesk'] text-[12px] font-semibold text-[#1B1C18] transition-colors hover:bg-[#F5F4ED] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6]"
        >
          View all calls
          <Icon kind="arrow" className="h-3 w-3" />
        </Link>
      </div>

      {recentCalls.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-9 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#EFEAFB] text-[#644ABB]">
            <Icon kind="calls" className="h-5 w-5" />
          </span>
          <p className="mt-3 font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
            No calls yet.
          </p>
          <p className="mt-1 max-w-[340px] font-['Space_Grotesk'] text-[12px] leading-5 text-[#666A68]">
            Your call activity will appear here once your AI agent starts making calls.
          </p>
          <button
            type="button"
            onClick={onPlaceTestCall}
            disabled={!canPlaceTestCall}
            title={!canPlaceTestCall ? "Set up your AI agent and import contacts first." : undefined}
            className="mt-4 inline-flex h-9 items-center gap-2 rounded-[6px] bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F] disabled:cursor-not-allowed disabled:bg-[#E9E8E1] disabled:text-[#929493]"
          >
            Place a test call
            <Icon kind="arrow" className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <div className="divide-y divide-[#ECEBE5]">
          {recentCalls.map((call, index) => {
            const callId = recordText(call, "id");
            const outcome = recordText(call, "outcome") ?? "unknown";
            const connected = outcome === "connected";
            const outcomeInfo = OUTCOME_BADGE[outcome] ?? {
              label: outcome.replaceAll("_", " "),
              tone: "border-[#E5E1D5] bg-[#F7F5EF] text-[#696B62]",
            };
            const contactName = recordText(call, "contactName");
            const phoneNumber = recordText(call, "phoneNumber");
            const primaryLabel = contactName ?? phoneNumber ?? "Unknown contact";
            const summary = recordText(call, "summary");
            const interestLevel = recordText(call, "interestLevel");
            const duration = formatDuration(recordNumber(call, "durationSeconds"));
            const startedAt = formatDate(call.startedAt, timezone);

            const content = (
              <div className="flex flex-col gap-2.5 px-5 py-3.5 transition-colors hover:bg-[#FAF9F5] sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] ${
                      connected ? "bg-[#EFF8F1] text-[#34734B]" : "bg-[#F3F2EC] text-[#666A68]"
                    }`}
                  >
                    <Icon kind={connected ? "conversation" : "calls"} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-['Space_Grotesk'] text-[13px] font-semibold text-[#1B1C18]">
                        {primaryLabel}
                      </p>
                      {contactName && phoneNumber ? (
                        <span className="font-['Space_Grotesk'] text-[11px] text-[#747878]">
                          {phoneNumber}
                        </span>
                      ) : null}
                      {interestLevel === "high" ? (
                        <span className="rounded-full bg-[#EFEAFB] px-2 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold text-[#644ABB]">
                          High intent
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 line-clamp-1 font-['Space_Grotesk'] text-[12px] text-[#565B5B]">
                      {summary ?? "No conversation summary recorded for this call."}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold capitalize ${outcomeInfo.tone}`}
                  >
                    {outcomeInfo.label}
                  </span>
                  <span className="font-['Space_Grotesk'] text-[11px] tabular-nums text-[#747878]">
                    {duration} · {startedAt}
                  </span>
                </div>
              </div>
            );

            return callId ? (
              <Link
                key={callId}
                href={`/dashboard/calls/${encodeURIComponent(callId)}`}
                className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7852D6]"
              >
                {content}
              </Link>
            ) : (
              <div key={`${outcome}-${index}`}>{content}</div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const TIMEFRAME_OPTIONS: Array<{ value: OverviewTimeframe; label: string }> = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

export function OverviewDashboard({ data }: { data: DashboardOverviewData }) {
  const profile = useDashboardProfile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { requestedSetupAction, clearRequestedSetupAction } = useDashboardNavigation();
  const firstName = profile.displayName.trim().split(/\s+/)[0] || "there";

  const timeframe = useDashboardUiStore((state) => state.overviewTimeframe);
  const setTimeframe = useDashboardUiStore((state) => state.setOverviewTimeframe);
  const completionBannerDismissed = useDashboardUiStore((state) => state.completionBannerDismissed);
  const dismissCompletionBanner = useDashboardUiStore((state) => state.dismissCompletionBanner);
  const activeAction = useDashboardUiStore((state) => state.activeSetupAction);
  const setActiveAction = useDashboardUiStore((state) => state.setActiveSetupAction);

  const setupQuery = useQuery({
    queryKey: dashboardKeys.workspaceSetup(),
    queryFn: () =>
      fetchDashboardApi<JsonRecord>(
        "/workspace-setup",
        "Unable to load workspace setup status right now. Please retry.",
      ),
    initialData: data.setup.state === "ready" ? data.setup.data : undefined,
    staleTime: 45_000,
  });

  const analyticsQuery = useQuery({
    queryKey: dashboardKeys.overviewAnalytics(timeframe),
    queryFn: () =>
      fetchDashboardApi<JsonRecord>(
        `/analytics/overview?timeframe=${timeframe}`,
        "Unable to load workspace analytics right now. Please try again.",
      ),
    placeholderData: keepPreviousData,
    staleTime: 45_000,
  });

  const setupLoadResult = useMemo<LoadResult<JsonRecord>>(() => {
    if (setupQuery.data) {
      return { state: "ready", data: setupQuery.data };
    }
    if (setupQuery.isError) {
      const err = setupQuery.error;
      return {
        state: "error",
        status: err instanceof DashboardApiError ? err.status : undefined,
        error: sanitizeUserError(
          err instanceof Error ? err.message : null,
          "Unable to load workspace setup status right now. Please retry.",
        ),
      };
    }
    return { state: "loading" };
  }, [setupQuery.data, setupQuery.isError, setupQuery.error]);

  const analyticsResult = useMemo<LoadResult<AnalyticsOverview>>(() => {
    if (analyticsQuery.isPending && !analyticsQuery.data) {
      return { state: "loading" };
    }
    if (analyticsQuery.isError && !analyticsQuery.data) {
      const err = analyticsQuery.error;
      return {
        state: "error",
        status: err instanceof DashboardApiError ? err.status : undefined,
        error: sanitizeUserError(
          err instanceof Error ? err.message : null,
          "Unable to load workspace analytics right now. Please try again.",
        ),
      };
    }
    const payload = analyticsQuery.data;
    if (!isJsonRecord(payload)) {
      return { state: "error", error: "The analytics response was invalid." };
    }
    if (
      !isJsonRecord(payload.quota) ||
      !isJsonRecord(payload.callMetrics) ||
      !isJsonRecord(payload.pipeline)
    ) {
      return {
        state: "error",
        error: "The analytics response is missing required workspace metrics.",
      };
    }
    return {
      state: "ready",
      data: {
        timeframe: typeof payload.timeframe === "string" ? payload.timeframe : timeframe,
        client: isJsonRecord(payload.client) ? payload.client : {},
        quota: payload.quota,
        callMetrics: payload.callMetrics,
        leadIntelligence: isJsonRecord(payload.leadIntelligence)
          ? payload.leadIntelligence
          : {},
        pipeline: payload.pipeline,
        costs: isJsonRecord(payload.costs) ? payload.costs : {},
        recentCalls: Array.isArray(payload.recentCalls)
          ? payload.recentCalls.filter(isJsonRecord)
          : [],
        dailyTrend: Array.isArray(payload.dailyTrend)
          ? payload.dailyTrend.filter(isJsonRecord)
          : [],
        campaignPerformance: Array.isArray(payload.campaignPerformance)
          ? payload.campaignPerformance.filter(isJsonRecord)
          : [],
      },
    };
  }, [analyticsQuery.isPending, analyticsQuery.isError, analyticsQuery.error, analyticsQuery.data, timeframe]);

  const liveData = useMemo<DashboardOverviewData>(
    () => ({ ...data, setup: setupLoadResult }),
    [data, setupLoadResult],
  );

  const setupState = useMemo(() => evaluateWorkspaceSetup(liveData), [liveData]);
  const setupSummary =
    liveData.setup.state === "ready" && isJsonRecord(liveData.setup.data.setup)
      ? liveData.setup.data.setup
      : null;

  const canPlaceTestCall =
    setupSummary?.agentConfigured === true && setupSummary?.contactsImported === true;

  const searchParams = useSearchParams();
  const setupParam = searchParams?.get("setup") as SetupAction | null;

  useEffect(() => {
    if (
      setupParam &&
      ["voice", "contacts", "test-call", "campaign", "routing", "launch"].includes(setupParam)
    ) {
      setActiveAction(setupParam);
    }
  }, [setupParam]);

  useEffect(() => {
    if (requestedSetupAction) {
      setActiveAction(requestedSetupAction);
      clearRequestedSetupAction();
    }
  }, [requestedSetupAction, clearRequestedSetupAction]);

  const handleSetupAction = useCallback(
    (action: SetupAction) => {
      if (action === "campaign") {
        router.push("/dashboard/campaigns");
        return;
      }
      if (action === "contacts") {
        router.push("/dashboard/contacts?import=1");
        return;
      }
      setActiveAction(action);
    },
    [router],
  );

  const analytics = analyticsResult.state === "ready" ? analyticsResult.data : null;
  const callMetrics = analytics?.callMetrics;
  const pipeline = analytics?.pipeline;
  const leadIntelligence = analytics?.leadIntelligence;
  const timezone = profile.timezone || "Asia/Kolkata";
  const workspaceStatus =
    recordText(analytics?.client, "status") ?? (profile.isTrial ? "trialing" : "active");

  const timeframeLabel =
    TIMEFRAME_OPTIONS.find((item) => item.value === timeframe)?.label ?? "Last 30 days";

  const headerPrimaryAction = useMemo(() => {
    if (!setupState.isComplete && setupState.nextRequiredStep) {
      return {
        label: setupState.nextRequiredStep.action,
        onClick: () => handleSetupAction(setupState.nextRequiredStep!.actionKey),
      };
    }
    return {
      label: "Create campaign",
      onClick: () => router.push("/dashboard/campaigns"),
    };
  }, [setupState.isComplete, setupState.nextRequiredStep, handleSetupAction, router]);

  const actionCenterItems = useMemo<WorkspaceActionItem[]>(() => {
    const items: WorkspaceActionItem[] = [];
    const allowance = recordNumber(analytics?.quota, "monthlyCreditsAllowance") ?? 0;
    const remaining = recordNumber(analytics?.quota, "creditsRemaining") ?? 0;
    const openFollowUps = recordNumber(pipeline, "openFollowUps") ?? 0;
    const knowledgeBaseCount = recordNumber(setupSummary, "knowledgeBaseCount") ?? 0;
    const campaignCount = recordNumber(setupSummary, "campaignCount") ?? 0;
    const activeCampaignCount = recordNumber(setupSummary, "activeCampaignCount") ?? 0;
    const testCallComplete = setupSummary?.testCallComplete === true;

    if (workspaceStatus === "suspended" || workspaceStatus === "paused") {
      items.push({
        id: "workspace-paused",
        priority: "critical",
        title: `Workspace calling is ${workspaceStatus}`,
        description: "Outbound calls are currently blocked until your workspace status is active.",
        ctaLabel: "Review settings",
        icon: "alert",
        onTrigger: () => router.push("/dashboard/settings"),
      });
    }

    if (analytics && allowance > 0 && remaining === 0) {
      const isTrialWorkspace = workspaceStatus === "trialing" || profile.isTrial;
      items.push({
        id: "credits-exhausted",
        priority: "critical",
        title: isTrialWorkspace ? "Trial voice credits exhausted" : "Monthly voice credits exhausted",
        description: isTrialWorkspace
          ? "New outbound calls cannot be placed until you upgrade to a paid plan."
          : "New outbound calls cannot be placed until your cycle resets or you upgrade.",
        ctaLabel: "View billing",
        icon: "credit",
        onTrigger: () => router.push("/dashboard/settings"),
      });
    } else if (analytics && allowance > 0 && remaining / allowance <= 0.2) {
      items.push({
        id: "credits-low",
        priority: "important",
        title: `Voice credits running low (${formatNumber(remaining)} left)`,
        description: "Top up or upgrade your plan before active campaigns pause mid-run.",
        ctaLabel: "Manage plan",
        icon: "credit",
        onTrigger: () => router.push("/dashboard/settings"),
      });
    }

    if (openFollowUps > 0) {
      items.push({
        id: "open-followups",
        priority: "important",
        title: `${formatNumber(openFollowUps)} open ${openFollowUps === 1 ? "follow-up" : "follow-ups"} awaiting action`,
        description: "Review requested callbacks and high-intent leads that need human follow-up.",
        ctaLabel: "Open follow-ups",
        icon: "followup",
        onTrigger: () => router.push("/dashboard/follow-ups"),
      });
    }

    if (setupState.isComplete && campaignCount > 0 && activeCampaignCount === 0) {
      items.push({
        id: "no-active-campaign",
        priority: "important",
        title: "No active campaign running",
        description: "You have saved campaigns in draft or paused state ready to resume or launch.",
        ctaLabel: "View campaigns",
        icon: "campaign",
        onTrigger: () => router.push("/dashboard/campaigns"),
      });
    }

    if (liveData.setup.state === "ready" && knowledgeBaseCount === 0) {
      items.push({
        id: "missing-kb",
        priority: "recommended",
        title: "Add knowledge base entries",
        description:
          "Upload FAQs, pricing, and policies so your AI agent answers caller questions accurately.",
        ctaLabel: "Configure KB",
        icon: "knowledge",
        onTrigger: () => router.push("/dashboard/ai-studio"),
      });
    }

    if (setupState.isComplete && !testCallComplete && canPlaceTestCall) {
      items.push({
        id: "optional-test-call",
        priority: "informational",
        title: "Run an optional voice test call",
        description:
          "Call your own number to verify pacing, pronunciation, and greeting changes.",
        ctaLabel: "Place test call",
        icon: "voice",
        onTrigger: () => setActiveAction("test-call"),
      });
    }

    return items;
  }, [
    analytics,
    pipeline,
    setupSummary,
    workspaceStatus,
    profile.isTrial,
    setupState.isComplete,
    liveData.setup.state,
    canPlaceTestCall,
    router,
  ]);

  const totalCalls = recordNumber(callMetrics, "totalCalls");
  const connectedCalls = recordNumber(callMetrics, "connectedCalls");
  const connectionRate = recordNumber(callMetrics, "connectionRatePercent");
  const highInterestCount = recordNumber(leadIntelligence, "highInterestCount");
  const openFollowUpsCount = recordNumber(pipeline, "openFollowUps");

  return (
    <div className="flex flex-col gap-6">
      <header className="mb-4 sm:mb-6 border-b border-[#ECEBE5] pb-6 sm:pb-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          
          {/* Left Side: Overline, Greeting, Metadata */}
          <div className="flex flex-col gap-4">
            
            {/* Top Row: Overline & Status */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-['Space_Grotesk'] text-[11px] font-bold uppercase tracking-[0.1em] text-[#8E918B]">
                Workspace Overview
              </span>

              {profile.isTrial ? (
                <>
                  <span className="h-3 w-px bg-[#D8D8D1]" />
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold tracking-wide ${
                      profile.trialExpired
                        ? "bg-[#FBE8E6] text-[#A33A32]"
                        : profile.trialDaysLeft !== null && profile.trialDaysLeft <= 3
                          ? "bg-[#FFFAEC] text-[#8A6826]"
                          : "bg-[#EFEAFB] text-[#644ABB]"
                    }`}
                  >
                    {profile.trialExpired
                      ? "Trial expired"
                      : profile.trialDaysLeft === 0
                        ? "Trial ends today"
                        : `Trial ends in ${profile.trialDaysLeft} ${profile.trialDaysLeft === 1 ? "day" : "days"}`}
                  </span>
                </>
              ) : workspaceStatus !== "active" ? (
                <>
                  <span className="h-3 w-px bg-[#D8D8D1]" />
                  <span className="inline-flex items-center rounded-full border border-[#F0D8D4] bg-[#FFF8F7] px-2.5 py-0.5 font-['Space_Grotesk'] text-[10px] font-semibold capitalize text-[#A33A32]">
                    {workspaceStatus}
                  </span>
                </>
              ) : null}
            </div>

            {/* Bottom Row: Greeting & Metadata */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between lg:block">
              <h1 className="font-['Newsreader'] text-[34px] leading-[1.1] tracking-[-0.5px] text-[#1B1C18] sm:text-[42px]">
                {profile.greeting},{" "}
                <span className="italic">{firstName}</span>
              </h1>

              {/* Metadata (Placed below greeting) */}
              <div className="mt-2 flex flex-wrap items-center gap-2.5 font-['Space_Grotesk'] text-[13px] text-[#747878]">
                <span className="font-medium text-[#1B1C18]">{profile.workspaceName}</span>
                <span className="text-[#D8D8D1]">&bull;</span>
                <span>{timezone}</span>
              </div>
            </div>
          </div>

          {/* Right Side: Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <label className="sr-only" htmlFor="overview-timeframe-select">
              Metrics date range
            </label>
            <select
              id="overview-timeframe-select"
              value={timeframe}
              onChange={(event) => setTimeframe(event.target.value as OverviewTimeframe)}
              className="h-9 rounded-[6px] border border-[#DCDDD6] bg-white px-3 font-['Space_Grotesk'] text-[12px] font-medium text-[#1B1C18] outline-none transition-colors hover:border-[#C5C6BE] focus:border-[#7852D6] focus:ring-2 focus:ring-[#7852D6]/15"
            >
              {TIMEFRAME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={headerPrimaryAction.onClick}
              className="inline-flex h-9 items-center gap-2 rounded-[6px] bg-[#1B1C18] px-4 font-['Space_Grotesk'] text-[12px] font-semibold text-white transition-colors hover:bg-[#34352F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7852D6] focus-visible:ring-offset-2"
            >
              <span>{headerPrimaryAction.label}</span>
              <Icon kind="arrow" className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {setupState.isComplete && !completionBannerDismissed ? (
        <div className="flex items-center justify-between gap-3 rounded-[10px] border border-[#CDE5D4] bg-[#F4FBF6] px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E1F3E6] text-[#25633A]">
              <Icon kind="check" className="h-3.5 w-3.5" />
            </span>
            <p className="truncate font-['Space_Grotesk'] text-[12px] text-[#214D30]">
              <span className="font-semibold">Workspace setup complete.</span> Your command center
              is now tracking live operations.
            </p>
          </div>
          <button
            type="button"
            onClick={dismissCompletionBanner}
            className="shrink-0 font-['Space_Grotesk'] text-[11px] font-semibold text-[#25633A] hover:underline"
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <section aria-labelledby="metrics-heading">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2
            id="metrics-heading"
            className="font-['Space_Grotesk'] text-[10px] font-bold uppercase tracking-[0.08em] text-[#747878]"
          >
            KEY PERFORMANCE METRICS
          </h2>
          <span className="font-['Space_Grotesk'] text-[11px] font-medium text-[#747878]">
            {timeframeLabel}
          </span>
        </div>

        {analyticsResult.state === "loading" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-[126px] rounded-[12px] border border-[#E9E8E1] bg-[#FAF9F4] p-4 sm:p-5"
              >
                <div className="h-3 w-24 animate-pulse motion-reduce:animate-none rounded bg-[#ECEBE5]" />
                <div className="mt-4 h-8 w-16 animate-pulse motion-reduce:animate-none rounded bg-[#E7E5DE]" />
                <div className="mt-3 h-2.5 w-32 animate-pulse motion-reduce:animate-none rounded bg-[#F1F0EB]" />
              </div>
            ))}
          </div>
        ) : analyticsResult.state === "error" ? (
          <SectionError
            title="Workspace analytics"
            error={analyticsResult.error}
            onRetry={() => void analyticsQuery.refetch()}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Total calls"
              value={formatNumber(totalCalls)}
              subtext={
                totalCalls && totalCalls > 0
                  ? `${formatNumber(connectedCalls)} connected · no prior baseline`
                  : "No calls in selected period"
              }
              icon="calls"
              href="/dashboard/calls"
            />
            <MetricCard
              label="Connection rate"
              value={
                totalCalls && totalCalls > 0
                  ? `${(connectionRate ?? 0).toFixed(1)}%`
                  : "0%"
              }
              badge={
                totalCalls && totalCalls > 0
                  ? `${formatNumber(connectedCalls)}/${formatNumber(totalCalls)}`
                  : undefined
              }
              subtext={
                totalCalls && totalCalls > 0
                  ? `${formatNumber(connectedCalls)} of ${formatNumber(totalCalls)} calls connected`
                  : "Requires at least 1 call"
              }
              icon="activity"
              href="/dashboard/calls?outcome=connected"
            />
            <MetricCard
              label="Interested leads"
              value={formatNumber(highInterestCount)}
              subtext="Calls marked high interest"
              icon="contacts"
              href="/dashboard/calls?interestLevel=high"
            />
            <MetricCard
              label="Follow-ups due"
              value={formatNumber(openFollowUpsCount)}
              subtext="Open follow-up tasks awaiting action"
              icon="followup"
              href="/dashboard/follow-ups?status=open"
            />
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-8">
          {!setupState.isComplete && liveData.setup.state !== "loading" ? (
            <SetupChecklist
              setupState={setupState}
              setupError={liveData.setup.state === "error" ? liveData.setup.error : null}
              onRetrySetup={() => void setupQuery.refetch()}
              onAction={handleSetupAction}
            />
          ) : null}

          <ActionCenter
            items={actionCenterItems}
            loading={analyticsResult.state === "loading" && liveData.setup.state === "loading"}
          />

          {analytics ? (
            <PerformanceAnalytics
              analytics={analytics}
              timeframeLabel={timeframeLabel}
              onPlaceTestCall={() => setActiveAction("test-call")}
              canPlaceTestCall={canPlaceTestCall}
            />
          ) : analyticsResult.state === "loading" ? (
            <div
              className="rounded-[12px] border border-[#E9E8E1] bg-white p-5"
              aria-busy="true"
            >
              <div className="h-3.5 w-36 animate-pulse motion-reduce:animate-none rounded bg-[#ECEBE5]" />
              <div className="mt-5 h-40 animate-pulse motion-reduce:animate-none rounded-[8px] bg-[#F5F4ED]" />
            </div>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-5 lg:col-span-4" aria-label="Workspace capacity and health">
          {analytics ? (
            <QuotaPanel
              analytics={analytics}
              timezone={timezone}
              isTrial={workspaceStatus === "trialing" || profile.isTrial}
              trialEndsAt={profile.trialEndsAt}
              onUpgrade={() => router.push("/dashboard/settings")}
            />
          ) : analyticsResult.state === "loading" ? (
            <div
              className="rounded-[12px] border border-[#E9E8E1] bg-white p-5"
              aria-busy="true"
            >
              <div className="h-3 w-24 animate-pulse motion-reduce:animate-none rounded bg-[#ECEBE5]" />
              <div className="mt-5 h-9 w-28 animate-pulse motion-reduce:animate-none rounded bg-[#E7E5DE]" />
              <div className="mt-4 h-20 w-full animate-pulse motion-reduce:animate-none rounded bg-[#F1F0EB]" />
            </div>
          ) : null}

          <WorkspaceHealth
            data={liveData}
            workspaceStatus={workspaceStatus}
            onRetrySetup={() => void setupQuery.refetch()}
            onOpenRouting={() => setActiveAction("routing")}
          />
        </aside>
      </div>

      {analytics ? (
        <RecentCalls
          analytics={analytics}
          timezone={timezone}
          onPlaceTestCall={() => setActiveAction("test-call")}
          canPlaceTestCall={canPlaceTestCall}
        />
      ) : analyticsResult.state === "loading" ? (
        <div className="rounded-[12px] border border-[#E9E8E1] bg-white p-5" aria-busy="true">
          <div className="h-3.5 w-32 animate-pulse motion-reduce:animate-none rounded bg-[#ECEBE5]" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="h-8 w-8 animate-pulse motion-reduce:animate-none rounded-[6px] bg-[#ECEBE5]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-40 animate-pulse motion-reduce:animate-none rounded bg-[#ECEBE5]" />
                  <div className="h-2.5 w-60 animate-pulse motion-reduce:animate-none rounded bg-[#F1F0EB]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {activeAction ? (
        <SetupWizardModal
          action={activeAction}
          data={data}
          onClose={() => setActiveAction(null)}
          onComplete={() => {
            setActiveAction(null);
            void queryClient.invalidateQueries({ queryKey: dashboardKeys.workspaceSetup() });
            void queryClient.invalidateQueries({ queryKey: dashboardKeys.overviewAnalytics(timeframe) });
          }}
          onSwitchAction={(nextAction) => setActiveAction(nextAction)}
        />
      ) : null}
    </div>
  );
}