import "server-only";

import { DEV_TEST_PLAN_ID, LOCAL_DEV_TEST_PLAN } from "@/features/billing/utils/dev-test-plan";
import { isLocalhostRequest } from "@/features/billing/utils/localhost-guard";

export type DevTestGuardAudit = {
  planId: string;
  isProductionEnv: boolean;
  isLocalhostHost: boolean;
  allowed: boolean;
  amountPaise: number | null;
};

/**
 * Evaluates whether a billing plan request is permitted under current runtime
 * environment and request host headers.
 */
export function evaluateBillingPlanAccess(
  planId: string,
  headersLike: { get(name: string): string | null | undefined },
): DevTestGuardAudit {
  const isProductionEnv = process.env.NODE_ENV === "production";
  if (planId !== DEV_TEST_PLAN_ID) {
    return {
      planId,
      isProductionEnv,
      isLocalhostHost: false,
      allowed: true,
      amountPaise: null,
    };
  }

  const isLocalhostHost = !isProductionEnv && isLocalhostRequest(headersLike);
  return {
    planId,
    isProductionEnv,
    isLocalhostHost,
    allowed: isLocalhostHost,
    amountPaise: isLocalhostHost ? LOCAL_DEV_TEST_PLAN.amountPaise : null,
  };
}
