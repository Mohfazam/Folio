export const DEV_TEST_PLAN_ID = "dev_test" as const;
export const DEV_TEST_PLAN_AMOUNT_INR = 5;
export const DEV_TEST_PLAN_AMOUNT_PAISE = 500;

export type DevTestPlan = {
  id: typeof DEV_TEST_PLAN_ID;
  name: string;
  amountInr: number;
  amountPaise: number;
  creditsLabel: string;
  badge: string;
  description: string;
  localhostOnly: true;
};

export const LOCAL_DEV_TEST_PLAN: DevTestPlan = {
  id: DEV_TEST_PLAN_ID,
  name: "Dev Test (₹5)",
  amountInr: DEV_TEST_PLAN_AMOUNT_INR,
  amountPaise: DEV_TEST_PLAN_AMOUNT_PAISE,
  creditsLabel: "Localhost test order",
  badge: "LOCALHOST ONLY",
  description:
    "₹5 local checkout & payment verification plan. Strictly available on localhost in non-production mode.",
  localhostOnly: true,
};

export function getAvailableLocalDevTestPlan(isLocalhost: boolean): DevTestPlan | null {
  if (!isLocalhost || process.env.NODE_ENV === "production") {
    return null;
  }
  return LOCAL_DEV_TEST_PLAN;
}
