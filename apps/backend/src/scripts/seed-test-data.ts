/**
 * Seed script: creates a test client, business profile, and campaign
 * so you can test the backend pipeline end-to-end.
 *
 * Run with:  npx tsx src/scripts/seed-test-data.ts
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { clients, businessProfiles, campaigns } from "@repo/db";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("Missing DATABASE_URL in .env");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

async function seed() {
  console.log("🌱 Seeding test data...\n");

  // 1. Create test client
  const [client] = await db
    .insert(clients)
    .values({
      name: "Test Academy",
      contactPersonName: "Test User",
      contactEmail: "test@example.com",
      contactPhone: "+919999999999",
      callerIdNumber: "+919999999999",
      callingHoursStart: "00:00:00",  // wide open for testing
      callingHoursEnd: "23:59:59",
      timezone: "Asia/Kolkata",
      planTier: "trial",
      monthlyCreditsAllowance: 1000,
      creditsUsedThisCycle: 0,
      maxCallsPerDay: 100,
      callsMadeToday: 0,
      status: "active",
    })
    .returning();

  console.log("✅ Client created:");
  console.log(`   ID:   ${client!.id}`);
  console.log(`   Name: ${client!.name}\n`);

  // 2. Create business profile
  const [bp] = await db
    .insert(businessProfiles)
    .values({
      clientId: client!.id,
      industry: "education",
      displayName: "Test Academy",
      description: "A test educational institution for pipeline testing",
      toneOfVoice: "Friendly, professional, and helpful",
      aiPersonaName: "Priya",
      catalogOfferings: [
        { name: "B.Tech Computer Science", fee: "₹2,00,000/year" },
        { name: "MBA", fee: "₹3,50,000/year" },
      ],
    })
    .returning();

  console.log("✅ Business profile created:");
  console.log(`   ID: ${bp!.id}\n`);

  // 3. Create a campaign
  const [campaign] = await db
    .insert(campaigns)
    .values({
      clientId: client!.id,
      name: "Admission Outreach 2026",
      type: "outreach_sales",
      status: "active",
      primaryObjective: "Inform prospective students about admission and convert interest into applications",
      callOpeningHook: "Hi, I'm calling from Test Academy about our upcoming admissions.",
      keyTalkingPoints: [
        "New campus facilities",
        "Placement record of 95%",
        "Scholarship options available",
      ],
      objectionHandlers: [
        { objection: "Too expensive", response: "We have scholarships covering up to 50% of tuition" },
        { objection: "Not interested", response: "I understand. May I send you a brochure for future reference?" },
      ],
      callToAction: "Would you like me to book a campus visit for you?",
      fallbackOffer: "I can send you our digital brochure with all the details",
    })
    .returning();

  console.log("✅ Campaign created:");
  console.log(`   ID:   ${campaign!.id}`);
  console.log(`   Name: ${campaign!.name}\n`);

  console.log("═══════════════════════════════════════════════");
  console.log("📋 SAVE THESE IDs FOR TESTING:");
  console.log(`   CLIENT_ID:   ${client!.id}`);
  console.log(`   CAMPAIGN_ID: ${campaign!.id}`);
  console.log("═══════════════════════════════════════════════\n");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
