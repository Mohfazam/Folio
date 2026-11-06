import { db, pool } from "../config/db.js";
import { businessProfiles, clients } from "@repo/db";

const clientId = process.env.PUBLIC_DEMO_CLIENT_ID?.trim();
if (!clientId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
  throw new Error("Set PUBLIC_DEMO_CLIENT_ID to a stable UUID before running setup:public-demo.");
}

const voiceId = process.env.PUBLIC_DEMO_AGENT_VOICE_ID?.trim() || "priya";
const supportedVoices = new Set([
  "shubh", "aditya", "ritu", "priya", "neha", "rahul", "pooja", "rohan", "simran",
  "kavya", "amit", "dev", "ishita", "shreya", "ratan", "varun", "manan", "sumit",
  "roopa", "kabir", "aayan", "ashutosh", "advait", "anand", "tanya", "tarun", "sunny",
  "mani", "gokul", "vijay", "shruti", "suhani", "mohit", "kavitha", "rehan", "soham", "rupali",
]);
if (!supportedVoices.has(voiceId)) throw new Error(`Unsupported Sarvam Bulbul v3 speaker: ${voiceId}`);
const agentName = process.env.PUBLIC_DEMO_AGENT_NAME?.trim() || "Aarohi";
const now = new Date().toISOString();

try {
  await db.insert(clients).values({
    id: clientId,
    name: "Foolioo Public Demo",
    timezone: "Asia/Kolkata",
    planTier: "scale",
    monthlyCreditsAllowance: 7200,
    maxCallsPerDay: 25,
    callingHoursStart: "09:00:00",
    callingHoursEnd: "20:00:00",
    status: "active",
    metadata: { systemWorkspace: "public_demo", managedBy: "setup:public-demo" },
  }).onConflictDoUpdate({
    target: clients.id,
    set: {
      name: "Foolioo Public Demo",
      timezone: "Asia/Kolkata",
      planTier: "scale",
      monthlyCreditsAllowance: 7200,
      maxCallsPerDay: 25,
      callingHoursStart: "09:00:00",
      callingHoursEnd: "20:00:00",
      status: "active",
      updatedAt: new Date(),
    },
  });

  const metadata = {
    aiAgentSettings: {
      version: 1,
      agentName,
      tone: "Warm, confident, clear, naturally conversational and professionally helpful. Speak at a measured pace. Avoid sounding scripted.",
      language: "en-IN",
      speechRate: 1,
      voiceId,
      greeting: "Hello! This is Aarohi, Foolioo's AI receptionist demo. You requested a short demonstration call. How can I help you today?",
      primaryObjective: "Demonstrate how a capable AI receptionist can handle common educational institute enquiries in a natural phone conversation.",
      handoffInstructions: "This is a showcase environment and no real institute staff are connected. Explain that a real institution can configure its own team handoff.",
      pronunciationNotes: "Use natural Indian English pronunciation. Speak clearly and avoid rushing.",
      complianceNotes: "Disclose that you are an AI assistant. Do not invent institute facts, course details, fees, eligibility, deadlines or policies.",
      updatedAt: now,
    },
  };

  await db.insert(businessProfiles).values({
    clientId,
    industry: "education",
    displayName: "Foolioo Institute Showcase",
    tagline: "A demonstration of an AI-powered institute receptionist",
    description: "A fictional showcase profile used only to demonstrate Foolioo's AI receptionist. It does not represent a real educational institution and has no real course catalogue, fee schedule or admissions policy.",
    operatingHours: "Demo calling hours: 9:00 AM to 8:00 PM India Standard Time.",
    toneOfVoice: "Warm, confident, clear and naturally conversational.",
    aiPersonaName: agentName,
    guardrails: [
      "Clearly disclose that you are an AI assistant in a Foolioo product demonstration.",
      "Never claim to represent a real school, college or university.",
      "Never invent courses, fees, eligibility requirements, deadlines, campus details or institutional policies.",
      "Do not request sensitive personal, financial, identity or education records.",
      "Respect requests to end the call immediately.",
    ],
    complianceNotes: "Public demo. No call recording or transcript retention. No real institute data is connected.",
    metadata,
  }).onConflictDoUpdate({
    target: businessProfiles.clientId,
    set: {
      industry: "education",
      displayName: "Foolioo Institute Showcase",
      tagline: "A demonstration of an AI-powered institute receptionist",
      description: "A fictional showcase profile used only to demonstrate Foolioo's AI receptionist. It does not represent a real educational institution and has no real course catalogue, fee schedule or admissions policy.",
      operatingHours: "Demo calling hours: 9:00 AM to 8:00 PM India Standard Time.",
      toneOfVoice: "Warm, confident, clear and naturally conversational.",
      aiPersonaName: agentName,
      guardrails: [
        "Clearly disclose that you are an AI assistant in a Foolioo product demonstration.",
        "Never claim to represent a real school, college or university.",
        "Never invent courses, fees, eligibility requirements, deadlines, campus details or institutional policies.",
        "Do not request sensitive personal, financial, identity or education records.",
        "Respect requests to end the call immediately.",
      ],
      complianceNotes: "Public demo. No call recording or transcript retention. No real institute data is connected.",
      metadata,
      updatedAt: new Date(),
    },
  });

  console.log(`[public-demo] Showcase workspace ${clientId} is ready. Voice: ${voiceId}.`);
} finally {
  await pool.end();
}
