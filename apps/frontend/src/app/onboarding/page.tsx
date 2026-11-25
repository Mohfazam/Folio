import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDashboardAuthContext } from "@/lib/auth/dashboard-request";
import {
  getOnboardingState,
  syncAndGetOnboardingState,
  type OnboardingSnapshot,
} from "../../lib/auth/backend";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

async function OnboardingContent() {
  await connection();

  const auth = await getDashboardAuthContext();
  if (!auth) redirect("/sign-in");

  let onboarding: OnboardingSnapshot | null;
  try {
    // Supabase OAuth users may need /api/auth/sync on first visit;
    // custom App JWT (Email + OTP) users already have their workspace provisioned.
    onboarding = auth.supabase
      ? await syncAndGetOnboardingState(auth.accessToken)
      : await getOnboardingState(auth.accessToken);
  } catch (err) {
    console.error("[onboarding/page] Unable to load onboarding:", err);
    throw new Error("We couldn't load your Foolioo workspace. Please refresh and try again.");
  }

  if (!onboarding) redirect("/sign-in");
  if (onboarding.status === "completed") redirect("/dashboard");

  return <OnboardingFlow initialOnboarding={onboarding} />;
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#FBF9F2]">
          <p className="text-sm text-[#747878]">Loading your workspace...</p>
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
