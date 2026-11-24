import "server-only";

import { NextResponse } from "next/server";
import { DEV_TEST_PLAN_ID } from "@/features/billing/utils/dev-test-plan";
import { isLocalhostRequest } from "@/features/billing/utils/localhost-guard";

/**
 * Enforces that the `dev_test` (₹5) plan can only be ordered or verified from
 * a strictly localhost request in non-production mode.
 */
export function enforceDevTestPlanAllowed(
  planId: unknown,
  headersLike: { get(name: string): string | null | undefined },
): NextResponse | null {
  if (planId !== DEV_TEST_PLAN_ID) {
    return null;
  }

  if (process.env.NODE_ENV === "production" || !isLocalhostRequest(headersLike)) {
    return NextResponse.json(
      {
        ok: false,
        error: "The localhost dev test plan is only available on localhost.",
      },
      { status: 403 },
    );
  }

  return null;
}
