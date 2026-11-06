import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

import Navbar from "@/components/Navbar";
import { Hero } from "@/components/hero";
import { TwoProducts } from "@/components/two-products";
import { TrustBar } from "@/components/trust-bar";
import { OutboundCalls } from "@/components/outbound-calls";
import { VoiceAgent } from "@/components/voice-agent";
import { CallsIntoAnswers } from "@/components/calls-into-answers";
import { Integrations } from "@/components/integrations";
import { Pricing } from "@/components/pricing";
import { CtaFooter } from "@/components/cta-footer";

type WorkspaceClient = {
  planTier: string;
  status: string;
  trialEndsAt: string | null;
};

function isWorkspaceClient(value: unknown): value is WorkspaceClient {
  return (
    typeof value === "object" &&
    value !== null &&
    "planTier" in value &&
    typeof value.planTier === "string" &&
    "status" in value &&
    typeof value.status === "string" &&
    "trialEndsAt" in value &&
    (typeof value.trialEndsAt === "string" || value.trialEndsAt === null)
  );
}

function hasTrialExpired(trialEndsAt: string): boolean {
  return new Date(trialEndsAt).getTime() < Date.now();
}

async function DynamicContent() {
  await connection();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let currentPlan = null;
  let planLoadError: string | null = null;

  if (user) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("No access token is available for the signed-in user.");
      }

      const backendUrl = process.env.BACKEND_API_URL?.trim().replace(/\/+$/, "");
      if (!backendUrl) {
        throw new Error("BACKEND_API_URL is not configured for the Next.js server.");
      }

      const response = await fetch(`${backendUrl}/api/clients`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });

      if (response.status !== 403) {
        const payload: unknown = await response.json();
        if (
          !response.ok ||
          typeof payload !== "object" ||
          payload === null ||
          !("clients" in payload) ||
          !Array.isArray(payload.clients)
        ) {
          throw new Error(`Unable to load workspace plan (${response.status}).`);
        }

        const clientRecord = payload.clients.find(isWorkspaceClient);
        if (clientRecord) {
          const tier = clientRecord.planTier;
          if (tier.toLowerCase() === "trial") {
            if (clientRecord.status !== "trialing") {
              currentPlan = "Expired";
            } else if (clientRecord.trialEndsAt) {
              const trialEndsAt = new Date(clientRecord.trialEndsAt).getTime();
              if (!Number.isFinite(trialEndsAt)) {
                throw new Error("The workspace has an invalid trial end date.");
              }
              currentPlan = hasTrialExpired(clientRecord.trialEndsAt) ? "Expired" : "Trial";
            } else {
              currentPlan = "Trial";
            }
          } else {
            currentPlan = tier;
          }
        }
      }
    } catch (error) {
      console.error("[home] Failed to fetch workspace plan from Neon:", error);
      planLoadError = "We couldn't load your current plan. Please refresh the page.";
    }
  }

  return (
    <>
      {/* Pass the boolean to OutboundCalls */}
      <OutboundCalls isLoggedIn={Boolean(user)} />
      
      <VoiceAgent />
      <CallsIntoAnswers />
      <Integrations />
      
      {planLoadError && (
        <p role="status" className="mx-auto max-w-[1240px] px-6 pb-4 text-sm text-red-700 md:px-10">
          {planLoadError}
        </p>
      )}
      <Pricing currentPlan={currentPlan} />
    </>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-[#FBF9F2] text-[#1B1C18]">
      <Navbar />
      <Hero />
      <TwoProducts />
      <TrustBar />
      
      <Suspense 
        fallback={
          <div className="flex w-full min-h-[800px] items-center justify-center bg-[#FBF9F2] text-[#747878]">
            Loading...
          </div>
        }
      >
        <DynamicContent />
      </Suspense>

      <CtaFooter />
    </main>
  );
}