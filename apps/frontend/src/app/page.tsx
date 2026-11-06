import { Suspense } from "react";
import { connection } from "next/server";
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
import { createClient } from "@/lib/supabase/server";

// 1. We refactor this to pass down both currentPlan AND isLoggedIn
async function DynamicContent() {
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let currentPlan = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier")
      .eq("id", user.id)
      .single();
    currentPlan = profile?.subscription_tier ?? null;
  }

  return (
    <>
      {/* Pass isLoggedIn to OutboundCalls */}
      <OutboundCalls isLoggedIn={Boolean(user)} />
      
      <VoiceAgent />
      <CallsIntoAnswers />
      <Integrations />
      
      {/* Pass currentPlan to Pricing */}
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
      
      {/* Wrap BOTH components in the Suspense boundary */}
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