"use client";

import { create } from "zustand";
import type { OverviewTimeframe } from "@/app/(dashboard)/dashboard/actions";
import type { DashboardSetupAction } from "@/components/dashboard/dashboard-shell";

type DashboardUiState = {
  overviewTimeframe: OverviewTimeframe;
  completionBannerDismissed: boolean;
  activeSetupAction: DashboardSetupAction | null;
  setOverviewTimeframe: (timeframe: OverviewTimeframe) => void;
  dismissCompletionBanner: () => void;
  setActiveSetupAction: (action: DashboardSetupAction | null) => void;
  resetUiState: () => void;
};

export const useDashboardUiStore = create<DashboardUiState>((set) => ({
  overviewTimeframe: "30d",
  completionBannerDismissed: false,
  activeSetupAction: null,
  setOverviewTimeframe: (overviewTimeframe) => set({ overviewTimeframe }),
  dismissCompletionBanner: () => set({ completionBannerDismissed: true }),
  setActiveSetupAction: (activeSetupAction) => set({ activeSetupAction }),
  resetUiState: () =>
    set({
      overviewTimeframe: "30d",
      completionBannerDismissed: false,
      activeSetupAction: null,
    }),
}));
