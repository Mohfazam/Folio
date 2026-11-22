// In Node 22+, globalThis.WebSocket drops custom headers in constructor.
delete (globalThis as any).WebSocket;

import { startServer } from "./sarwar.js";
import { initiateOutboundCall } from "./providers/plivo/dial.js";
import type { PromptContext } from "./prompts/compileSystemPrompt.js";

async function main() {
  console.log("Starting Folio Calling Voice Engine on port 3000...");
  const server = startServer();

  // Give the server 1 second to bind to port 3000
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const targetPhoneNumber = "+919346601744";

  const context: PromptContext = {
    business: {
      displayName: "Intermediate MPC Admissions Desk",
      industry: "Higher Secondary Education",
      aiPersonaName: "Admissions Counselor",
      toneOfVoice: "Warm, professional, knowledgeable, polite, conversational, and concise",
      description: "2-year Intermediate MPC (Mathematics, Physics, Chemistry) academic program with strong foundational coaching for board exams and entrance tests.",
      catalogOfferings: [
        {
          name: "2-Year Intermediate MPC Program",
          category: "Intermediate / 11th & 12th",
          price: "₹45,000 per year",
          duration: "2 Years",
          description: "Comprehensive MPC curriculum with integrated foundational coaching for board exams and competitive entrance tests.",
          keyBenefits: [
            "Transparent fee with flexible installment options",
            "Experienced faculty and regular doubt-clearing sessions",
            "Structured test series and continuous performance monitoring",
            "Limited batch sizes with early-admission benefits",
          ],
        },
      ],
      guardrails: [
        "Never invent fees or charges beyond the ₹45,000 per year tuition.",
        "Always be courteous, respectful, and supportive to both students and parents.",
        "If they speak in Telugu or Hindi, seamlessly converse in their preferred language.",
        "This is an interactive two-way conversation. Answer all questions directly, thoroughly, and completely.",
        "Never cut off mid-thought. Always complete your sentences.",
        "NEVER hang up the call or say goodbye and disconnect. The caller will hang up their phone when they are finished.",
      ],
    },
    campaign: {
      name: "Admissions 2026",
      primaryObjective:
        "Drive student admissions into our 2-year MPC (Mathematics, Physics, Chemistry) intermediate program priced at ₹45,000 per year, and book campus counseling visits or seat reservations with parents and students.",
      callOpeningHook:
        "Hello! This is the admissions desk calling regarding your recent inquiry for our Intermediate MPC program. Is this a good time to speak with you or a parent for a quick minute?",
      keyTalkingPoints: [
        "Admissions are open for our MPC (Maths, Physics, Chemistry) program with strong foundational coaching for board exams and entrance tests.",
        "Annual tuition is ₹45,000 per year with transparent fee details and flexible installment options.",
        "Experienced faculty, regular doubt-clearing sessions, and structured test series to keep students on track.",
        "Limited seats available for the upcoming batch so students can lock in early-admission benefits.",
      ],
      callToAction:
        "Would you like to schedule a brief campus visit with your parents this week or get the fee breakdown and brochure sent over on WhatsApp/email?",
      fallbackOffer:
        "No problem at all—if you aren't ready to visit right now, I can share the full syllabus, fee structure, and seat availability details so you can review them at your own pace and follow up anytime.",
      objectionHandlers: [
        {
          objection: "₹45,000 per year is a bit high / let me check our budget",
          counterResponse:
            "I completely understand—education is a big decision. The ₹45,000 annual fee covers core instruction and academic support with no hidden surprise charges, and we can walk through available installment options or scholarship/merit checks if applicable.",
        },
        {
          objection: "We are still comparing other colleges",
          counterResponse:
            "That makes total sense. Many parents compare a few options first. If you share what matters most—like faculty support, test prep, or commute—I can give you exact details on how we handle that so you have a clear comparison.",
        },
        {
          objection: "The student hasn't decided between MPC and another stream yet",
          counterResponse:
            "Totally fair. MPC keeps strong options open across engineering, tech, analytics, and quantitative fields. You're welcome to bring the student for a quick counseling chat so they can ask questions directly before deciding.",
        },
        {
          objection: "Call me later / I'm busy right now",
          counterResponse:
            "Of course, I won't take up your time. When would be a convenient time tomorrow or later this week for a quick two-minute call?",
        },
      ],
    },
    contact: {
      fullName: "Prospective Student / Parent",
      phoneNumber: targetPhoneNumber,
    },
  };

  const greetingText =
    "Hello! This is the admissions desk calling regarding your recent inquiry for our Intermediate MPC program. Is this a good time to speak with you or a parent for a quick minute?";

  console.log(`Initiating recorded campaign call to ${targetPhoneNumber}...`);

  const dialResult = await initiateOutboundCall({
    phoneNumber: targetPhoneNumber,
    clientId: "admissions-campaign",
    contactId: "admissions-9346601744",
    campaignId: "admissions-2026",
    maxDurationSeconds: 300,
    greetingText,
    context,
    recordCall: true,
    callbackUrl: "http://localhost:4000/api/calls/complete",
  });

  console.log("Dial succeeded! Plivo Call Details:", dialResult);
  console.log("Waiting for call interaction and recording...");
}

main().catch((err) => {
  console.error("FATAL ERROR placing admissions call:", err);
  process.exit(1);
});
