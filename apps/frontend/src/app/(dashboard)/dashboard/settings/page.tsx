import { Suspense } from "react";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";
import { SettingsQueryContainer } from "@/components/dashboard/query-containers";

export default function SettingsPage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton variant="editor" />}>
      <SettingsQueryContainer />
    </Suspense>
  );
}
