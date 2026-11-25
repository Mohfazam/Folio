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
import { Faq } from "@/components/faq";
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

  let currentPlan: string | null = null;

  if (user) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const backendUrl = (
          process.env.BACKEND_API_URL?.trim() ||
          process.env.NEXT_PUBLIC_API_URL?.trim() ||
          "http://localhost:4000"
        ).replace(/\/+$/, "");

        const response = await fetch(`${backendUrl}/api/clients`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });

        if (response.ok) {
          const payload: unknown = await response.json();
          if (
            typeof payload === "object" &&
            payload !== null &&
            "clients" in payload &&
            Array.isArray(payload.clients)
          ) {
            const clientRecord = payload.clients.find(isWorkspaceClient);
            if (clientRecord) {
              const tier = clientRecord.planTier;
              if (tier.toLowerCase() === "trial") {
                if (clientRecord.status !== "trialing") {
                  currentPlan = "Expired";
                } else if (clientRecord.trialEndsAt) {
                  const trialEndsAt = new Date(clientRecord.trialEndsAt).getTime();
                  if (Number.isFinite(trialEndsAt)) {
                    currentPlan = hasTrialExpired(clientRecord.trialEndsAt) ? "Expired" : "Trial";
                  } else {
                    currentPlan = "Trial";
                  }
                } else {
                  currentPlan = "Trial";
                }
              } else {
                currentPlan = tier;
              }
            }
          }
        }
      }
    } catch (error) {
      // Fail silently on the landing page and fall back to default pricing view
      console.warn("[home] Workspace plan unavailable, falling back to default pricing:", error);
    }
  }

  return (
    <>
      <OutboundCalls isLoggedIn={Boolean(user)} />
      <VoiceAgent />
      <CallsIntoAnswers />
      <Integrations />
      <Pricing currentPlan={currentPlan} isLoggedIn={Boolean(user)} />
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
          <div className="flex min-h-[800px] w-full items-center justify-center bg-[#FBF9F2] text-sm font-medium text-[#525552]">
            Loading...
          </div>
        }
      >
        <DynamicContent />
      </Suspense>

      <Faq />
      <CtaFooter />
    </main>
  );
}
