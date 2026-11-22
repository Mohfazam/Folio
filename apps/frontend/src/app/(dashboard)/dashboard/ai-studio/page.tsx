import { Suspense } from "react";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";
import { AiStudioQueryContainer } from "@/components/dashboard/query-containers";

export default function AiStudioPage() {
  return (
    <Suspense fallback={<DashboardPageSkeleton variant="editor" />}>
      <AiStudioQueryContainer />
    </Suspense>
  );
}
