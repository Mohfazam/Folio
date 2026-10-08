import { pgTable, uuid, text, integer, timestamp, time, pgEnum, jsonb, boolean, real } from "drizzle-orm/pg-core";

// ── Enums ─────────────────────────────────────────────────────────────

export const planTierEnum = pgEnum("plan_tier", ["trial", "starter", "growth", "pro", "scale"]);

export const clientStatusEnum = pgEnum("client_status", ["trialing", "active", "paused", "suspended"]);

export const userRoleEnum = pgEnum("user_role", ["client_admin", "client_viewer", "internal_admin"]);

export const uploadStatusEnum = pgEnum("upload_status", ["processing", "completed", "failed"]);

export const contactStatusEnum = pgEnum("contact_status", [
  "pending",
  "queued",
  "in_progress",
  "completed",
  "do_not_call",
  "invalid",
]);

export const queueStatusEnum = pgEnum("queue_status", [
  "pending",
  "in_progress",
  "completed",
  "failed",
  "exhausted",
]);

// Calls
export const callOutcomeEnum = pgEnum("call_outcome", [
  "connected",
  "no_answer",
  "busy",
  "voicemail",
  "dropped_early",
  "failed",
]);

export const interestLevelEnum = pgEnum("interest_level", ["high", "medium", "low", "unknown"]);

export const sentimentEnum = pgEnum("sentiment", ["positive", "neutral", "negative"]);

// Follow-ups
export const followUpStatusEnum = pgEnum("follow_up_status", ["open", "done", "not_needed"]);

// Knowledge Base Entry Types (Multi-Tech, Enterprise & Universal)
export const kbEntryTypeEnum = pgEnum("kb_entry_type", [
  "faq",
  "product_feature",
  "pricing_plan",
  "technical_spec",
  "troubleshooting",
  "integration_guide",
  "competitor_comparison",
  "case_study",
  "policy_legal",
  "document",
  "course_info",
  "fee",
  "deadline",
  "policy",
]);

// Multi-Industry & Vertical Enums
export const industryTypeEnum = pgEnum("industry_type", [
  "saas_software",
  "developer_tools",
  "fintech",
  "ai_cloud",
  "healthtech",
  "ecommerce_retail",
  "cybersecurity",
  "education",
  "beauty_wellness",
  "healthcare",
  "real_estate",
  "automotive",
  "fitness",
  "professional_services",
  "retail",
  "general",
]);

export const campaignTypeEnum = pgEnum("campaign_type", [
  "outreach_sales",
  "follow_up",
  "reminder",
  "reactivation",
  "feedback_survey",
  "announcement",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "active",
  "paused",
  "completed",
]);

// ── Tables ────────────────────────────────────────────────────────────

export const clients = pgTable("clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  contactPersonName: text("contact_person_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  callerIdNumber: text("caller_id_number"),
  callingHoursStart: time("calling_hours_start").default("09:00:00"),
  callingHoursEnd: time("calling_hours_end").default("16:00:00"),
  timezone: text("timezone").notNull().default("Asia/Kolkata"),
  planTier: planTierEnum("plan_tier").notNull().default("trial"),
  monthlyCreditsAllowance: integer("monthly_credit_allowance").notNull().default(360),
  creditsUsedThisCycle: integer("credits_used_this_cycle").notNull().default(0),
  creditsReservedThisCycle: integer("credits_reserved_this_cycle").notNull().default(0),
  maxCallsPerDay: integer("max_calls_per_day").notNull().default(50),
  callsMadeToday: integer("calls_made_today").notNull().default(0),
  callsMadeTodayResetAt: timestamp("calls_made_today_reset_at"),
  planStartedAt: timestamp("plan_started_at"),
  nextBillingResetAt: timestamp("next_billing_reset_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  status: clientStatusEnum("status").notNull().default("trialing"),
  isPhoneVerified: boolean("is_phone_verified").notNull().default(false),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const businessProfiles = pgTable("business_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" })
    .unique(),
  industry: industryTypeEnum("industry").notNull().default("general"),
  displayName: text("display_name").notNull(),
  tagline: text("tagline"),
  description: text("description").notNull(),
  website: text("website"),
  address: text("address"),
  operatingHours: text("operating_hours"),
  supportPhone: text("support_phone"),
  catalogOfferings: jsonb("catalog_offerings").notNull().default([]),
  toneOfVoice: text("tone_of_voice").notNull().default("Warm, professional, knowledgeable, and concise"),
  aiPersonaName: text("ai_persona_name").default("Assistant"),
  guardrails: text("guardrails").array(),
  keyDifferentiators: text("key_differentiators").array(),
  complianceNotes: text("compliance_notes"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: campaignTypeEnum("type").notNull().default("outreach_sales"),
  status: campaignStatusEnum("status").notNull().default("draft"),
  primaryObjective: text("primary_objective").notNull(),
  callOpeningHook: text("call_opening_hook").notNull(),
  keyTalkingPoints: text("key_talking_points").array().notNull(),
  objectionHandlers: jsonb("objection_handlers").notNull().default([]),
  callToAction: text("call_to_action").notNull(),
  fallbackOffer: text("fallback_offer"),
  targetAudience: text("target_audience"),
  language: text("language").default("en-IN"),
  maxDurationSeconds: integer("max_duration_seconds").default(300),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id),
  firebaseUid: text("firebase_uid").unique(),
  email: text("email"),
  phoneNumber: text("phone_number"),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  authProvider: text("auth_provider").default("firebase"), // 'google', 'github', 'phone', 'password'
  passwordHash: text("password_hash"), // optional for OAuth/phone OTP
  role: userRoleEnum("role").notNull().default("client_admin"),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const uploadBatches = pgTable("upload_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  filename: text("filename").notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  totalRows: integer("total_rows"),
  validRows: integer("valid_rows"),
  invalidRows: integer("invalid_rows"),
  duplicateRows: integer("duplicate_rows"),
  status: uploadStatusEnum("status").notNull().default("processing"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  uploadBatchId: uuid("upload_batch_id").references(() => uploadBatches.id),
  
  // Primary Contact Info
  fullName: text("full_name"),
  secondaryName: text("secondary_name"),
  phoneNumber: text("phone_number").notNull(),
  phoneNumberRaw: text("phone_number_raw"),
  email: text("email"),

  // Enterprise & Cross-Industry Profile Attributes
  companyName: text("company_name"),
  jobTitle: text("job_title"),
  department: text("department"),
  industry: text("industry"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  timezone: text("timezone"),

  // CRM / Lifecycle Tracking
  leadScore: integer("lead_score"),
  lifecycleStage: text("lifecycle_stage"), // 'lead', 'prospect', 'mql', 'sql', 'customer', 'churned'
  accountTier: text("account_tier"), // 'Enterprise', 'Mid-Market', 'SMB', 'VIP'
  tags: text("tags").array(),

  // Legacy / Domain-Specific Aliases
  parentName: text("parent_name"),
  studentName: text("student_name"),
  courseOrStream: text("course_or_stream"),

  // Flexible Structured Data
  contextData: jsonb("context_data").default({}),
  customFields: jsonb("custom_fields").default({}),
  
  status: contactStatusEnum("status").notNull().default("pending"),
  isDuplicateOf: uuid("is_duplicate_of"),
  optOut: boolean("opt_out").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const callQueue = pgTable("call_queue", {
  id: uuid("id").primaryKey().defaultRandom(),
  contactId: uuid("contact_id").notNull().references(() => contacts.id),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  campaignId: uuid("campaign_id").references(() => campaigns.id),
  contactName: text("contact_name"),
  phoneNumber: text("phone_number"),
  scheduledFor: timestamp("scheduled_for").notNull(),
  attemptNumber: integer("attempt_number").notNull().default(1),
  priority: integer("priority").notNull().default(0),
  status: queueStatusEnum("status").notNull().default("pending"),
  maxAttempts: integer("max_attempts").notNull().default(2),
  reservedCredits: integer("reserved_credits").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const calls = pgTable("calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  deliveryId: text("delivery_id").unique(),
  contactId: uuid("contact_id").notNull().references(() => contacts.id),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  campaignId: uuid("campaign_id").references(() => campaigns.id),
  queueEntryId: uuid("queue_entry_id").references(() => callQueue.id),
  contactName: text("contact_name"),
  phoneNumber: text("phone_number"),
  attemptNumber: integer("attempt_number").notNull(),
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at"),
  durationSeconds: integer("duration_seconds"),
  outcome: callOutcomeEnum("outcome").notNull(),
  isBillable: boolean("is_billable").notNull().default(true),
  creditsCharged: integer("credits_charged").notNull().default(0),
  
  // AI Post-Call Summary & Insights
  summary: text("summary"),
  interestLevel: interestLevelEnum("interest_level"),
  sentiment: sentimentEnum("sentiment"),
  objectionsRaised: text("objections_raised").array(),
  keyActionItems: text("key_action_items").array(),
  followUpRequested: boolean("follow_up_requested").notNull().default(false),
  
  // Infrastructure Costs & Media
  recordingUrl: text("recording_url"),
  transcript: jsonb("transcript"), // array of { speaker: 'user' | 'assistant', text, timestamp }
  costTelephony: real("cost_telephony"),
  costStt: real("cost_stt"),
  costLlm: real("cost_llm"),
  costTts: real("cost_tts"),
  costTotal: real("cost_total"),
  
  knowledgeBaseVersionUsed: integer("knowledge_base_version_used"),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const followUps = pgTable("follow_ups", {
  id: uuid("id").primaryKey().defaultRandom(),
  callId: uuid("call_id").references(() => calls.id),
  contactId: uuid("contact_id").notNull().references(() => contacts.id),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  type: text("type").notNull().default("call_back"), // 'call_back', 'demo_scheduled', 'information_sent', 'escalation'
  priority: text("priority").notNull().default("medium"), // 'low', 'medium', 'high', 'urgent'
  dueDate: timestamp("due_date"),
  requestedCallbackTime: timestamp("requested_callback_time"),
  assignedTo: uuid("assigned_to").references(() => users.id),
  status: followUpStatusEnum("status").notNull().default("open"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => clients.id),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const knowledgeBaseEntries = pgTable("knowledge_base_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").notNull().references(() => clients.id),
  type: kbEntryTypeEnum("type").notNull(),
  title: text("title"),
  category: text("category"),
  question: text("question"),
  content: text("content").notNull(),
  tags: text("tags").array(),
  metadata: jsonb("metadata").default({}),
  priority: integer("priority").notNull().default(0),
  targetPersonas: text("target_personas").array(),
  version: integer("version").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});