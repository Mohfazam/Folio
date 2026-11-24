"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dashboardKeys } from "@/lib/query/keys";
import { createRazorpayOrder, fetchBillingStatus, verifyRazorpayPayment } from "../queries/api";
import type { CreateBillingOrderRequest, VerifyBillingPaymentRequest } from "../types";

export function useBillingStatus() {
  return useQuery({
    queryKey: dashboardKeys.billingStatus(),
    queryFn: fetchBillingStatus,
    staleTime: 30_000,
    retry: 1,
  });
}

export function useCreateRazorpayOrder() {
  return useMutation({
    mutationFn: (input: CreateBillingOrderRequest) => createRazorpayOrder(input),
  });
}

export function useVerifyRazorpayPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: VerifyBillingPaymentRequest) => verifyRazorpayPayment(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.billingStatus() });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.workspaceSetup() });
      void queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
}
