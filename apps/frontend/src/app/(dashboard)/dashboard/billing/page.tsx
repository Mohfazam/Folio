import { Suspense } from "react";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";
import { BillingDashboard } from "@/features/billing/components/billing-dashboard";

export default function BillingPage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton variant="editor" />}>
      <BillingDashboard />
    </Suspense>
  );
}
