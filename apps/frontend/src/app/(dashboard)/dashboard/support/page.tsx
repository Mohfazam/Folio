import { Suspense } from "react";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";
import { SupportDashboard } from "@/components/dashboard/support-dashboard";

export default function DashboardSupportPage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton variant="editor" />}>
      <SupportDashboard />
    </Suspense>
  );
}
