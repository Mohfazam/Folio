import { Suspense } from "react";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";
import { BillingDashboard } from "@/features/billing/components/billing-dashboard";
import { BillingErrorBoundary } from "@/features/billing/components/billing-error-boundary";

export default function BillingPage() {
  return (
    <BillingErrorBoundary>
      <Suspense fallback={<DashboardPageSkeleton variant="editor" />}>
        <BillingDashboard />
      </Suspense>
    </BillingErrorBoundary>
  );
}
