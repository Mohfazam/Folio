export type OverviewTimeframeKey = "today" | "7d" | "30d" | "90d" | "all";

export const dashboardKeys = {
  all: ["dashboard"] as const,
  workspaceSetup: () => [...dashboardKeys.all, "workspace-setup"] as const,
  overviewAnalytics: (timeframe: OverviewTimeframeKey) =>
    [...dashboardKeys.all, "analytics", "overview", timeframe] as const,
  campaigns: (params?: Record<string, unknown>) =>
    [...dashboardKeys.all, "campaigns", params ?? {}] as const,
  contacts: (params?: Record<string, unknown>) =>
    [...dashboardKeys.all, "contacts", params ?? {}] as const,
  calls: (params?: Record<string, unknown>) =>
    [...dashboardKeys.all, "calls", params ?? {}] as const,
  liveCalls: () => [...dashboardKeys.all, "calls", "live"] as const,
  followUps: (params?: Record<string, unknown>) =>
    [...dashboardKeys.all, "follow-ups", params ?? {}] as const,
  knowledgeBase: () => [...dashboardKeys.all, "knowledge-base"] as const,
  businessProfile: () => [...dashboardKeys.all, "business-profile"] as const,
  agentSettings: () => [...dashboardKeys.all, "agent-settings"] as const,
  billingStatus: () => [...dashboardKeys.all, "billing", "status"] as const,
  founderTickets: (params?: Record<string, unknown>) =>
    [...dashboardKeys.all, "founder", "tickets", params ?? {}] as const,
};
