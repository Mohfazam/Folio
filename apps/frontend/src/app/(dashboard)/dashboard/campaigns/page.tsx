import { Suspense } from "react";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";
import { CampaignsQueryContainer } from "@/components/dashboard/query-containers";

export default function CampaignsPage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton variant="table" />}>
      <CampaignsQueryContainer />
    </Suspense>
  );
}
