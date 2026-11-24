import { Suspense } from "react";
import { headers } from "next/headers";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";
import { BillingDashboard } from "@/features/billing/components/billing-dashboard";
import { isLocalhostRequest } from "@/features/billing/utils/localhost-guard";

async function BillingPageContent() {
  const reqHeaders = await headers();
  const isLocalDevTestAvailable = isLocalhostRequest(reqHeaders);

  return <BillingDashboard isLocalDevTestAvailable={isLocalDevTestAvailable} />;
}

export default function BillingPage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton variant="detail" />}>
      <BillingPageContent />
    </Suspense>
  );
}
