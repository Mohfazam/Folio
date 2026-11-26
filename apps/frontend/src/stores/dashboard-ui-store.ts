"use client";

import { create } from "zustand";
import type { OverviewTimeframe } from "@/app/(dashboard)/dashboard/actions";
import type { DashboardSetupAction } from "@/components/dashboard/dashboard-shell";

type DashboardUiState = {
  overviewTimeframe: OverviewTimeframe;
  completionBannerDismissed: boolean;
  activeSetupAction: DashboardSetupAction | null;
  founderTicketStatusFilter: string;
  founderTicketSearchQuery: string;
  selectedFounderTicketId: string | null;
  setOverviewTimeframe: (timeframe: OverviewTimeframe) => void;
  dismissCompletionBanner: () => void;
  setActiveSetupAction: (action: DashboardSetupAction | null) => void;
  setFounderTicketStatusFilter: (status: string) => void;
  setFounderTicketSearchQuery: (query: string) => void;
  setSelectedFounderTicketId: (id: string | null) => void;
  resetUiState: () => void;
};

export const useDashboardUiStore = create<DashboardUiState>((set) => ({
  overviewTimeframe: "30d",
  completionBannerDismissed: false,
  activeSetupAction: null,
  founderTicketStatusFilter: "all",
  founderTicketSearchQuery: "",
  selectedFounderTicketId: null,
  setOverviewTimeframe: (overviewTimeframe) => set({ overviewTimeframe }),
  dismissCompletionBanner: () => set({ completionBannerDismissed: true }),
  setActiveSetupAction: (activeSetupAction) => set({ activeSetupAction }),
  setFounderTicketStatusFilter: (founderTicketStatusFilter) => set({ founderTicketStatusFilter }),
  setFounderTicketSearchQuery: (founderTicketSearchQuery) => set({ founderTicketSearchQuery }),
  setSelectedFounderTicketId: (selectedFounderTicketId) => set({ selectedFounderTicketId }),
  resetUiState: () =>
    set({
      overviewTimeframe: "30d",
      completionBannerDismissed: false,
      activeSetupAction: null,
      founderTicketStatusFilter: "all",
      founderTicketSearchQuery: "",
      selectedFounderTicketId: null,
    }),
}));
