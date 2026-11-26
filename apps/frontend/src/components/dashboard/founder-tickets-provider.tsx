"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AdminTicketsDashboard } from "@/components/dashboard/admin-tickets-dashboard";

export function FounderTicketsProvider({ children }: { children?: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children ?? <AdminTicketsDashboard />}
    </QueryClientProvider>
  );
}
