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

// 1. The dynamic data fetching component
async function DynamicPricingSection() {
  // ✅ Forces Next.js to render this at request time, fixing the Date.now() error
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

  return <Pricing currentPlan={currentPlan} />;
}

// 2. The main static page
export default function Home() {
  return (
    <main className="min-h-screen bg-[#FBF9F2] text-[#1B1C18]">
      <Navbar />
      <Hero />
      <TwoProducts />
      <TrustBar />
      <OutboundCalls />
      <VoiceAgent />
      <CallsIntoAnswers />
      <Integrations />
      
      {/* 3. Suspense allows the page to load instantly while pricing fetches */}
      <Suspense 
        fallback={
          <div className="flex w-full min-h-[600px] items-center justify-center bg-[#FBF9F2] text-[#747878]">
            Loading pricing...
          </div>
        }
      >
        <DynamicPricingSection />
      </Suspense>

      <CtaFooter />
    </main>
  );
}