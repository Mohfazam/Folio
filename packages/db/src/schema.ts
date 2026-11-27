import { pgTable, uuid, text, integer, timestamp, time, pgEnum, jsonb, boolean, real, index } from "drizzle-orm/pg-core";

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

// Messaging
export const messageChannelEnum = pgEnum("message_channel", ["sms", "whatsapp"]);
export const messageDirectionEnum = pgEnum("message_direction", ["inbound", "outbound"]);
export const messageStatusEnum = pgEnum("message_status", [
  "queued",
  "sending",
  "sent",
  "delivered",
  "undelivered",
  "failed",
  "received",
]);

export const messageTypeEnum = pgEnum("message_type", [
  "post_call_followup",
  "campaign_outreach",
  "manual_direct",
  "system_alert",
  "inbound_reply",
]);

export const templateCategoryEnum = pgEnum("template_category", [
  "utility",
  "marketing",
  "authentication",
  "transactional",
]);

export const templateStatusEnum = pgEnum("template_status", [
  "draft",
  "pending_approval",
  "approved",
  "rejected",
  "disabled",
]);

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
  authUserId: text("auth_user_id").unique(),
  email: text("email"),
  phoneNumber: text("phone_number"),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  emailVerified: boolean("email_verified").notNull().default(false),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  authProvider: text("auth_provider").default("email"),
  passwordHash: text("password_hash"), // optional for OAuth/phone OTP
  role: userRoleEnum("role").notNull().default("client_admin"),
  metadata: jsonb("metadata").default({}),
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

export const recordingStatusEnum = pgEnum("recording_status", [
  "in_progress",
  "completed",
  "failed",
  "deleted",
]);

export const callRecordings = pgTable(
  "call_recordings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    callId: uuid("call_id").notNull().references(() => calls.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    plivoRecordingId: text("plivo_recording_id"),
    sourceUrl: text("source_url").notNull(),
    durationSeconds: integer("duration_seconds"),
    fileFormat: text("file_format").notNull().default("mp3"),
    fileSizeBytes: integer("file_size_bytes"),
    status: recordingStatusEnum("status").notNull().default("completed"),
    channels: integer("channels").notNull().default(1),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_call_recordings_call_id").on(table.callId),
    index("idx_call_recordings_client_id").on(table.clientId),
  ]
);

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

export const emailVerificationOtps = pgTable(
  "email_verification_otps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    otpHash: text("otp_hash").notNull(),
    purpose: text("purpose").notNull().default("auth_verification"),
    expiresAt: timestamp("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: timestamp("consumed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_email_verification_otps_email").on(table.email),
    index("idx_email_verification_otps_purpose").on(table.purpose),
  ]
);

export const billingOrders = pgTable(
  "billing_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    planId: text("plan_id").notNull(),
    planName: text("plan_name").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    creditsGranted: integer("credits_granted").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: text("status").notNull().default("created"),
    method: text("method"),
    razorpayOrderId: text("razorpay_order_id").unique(),
    razorpayPaymentId: text("razorpay_payment_id").unique(),
    razorpaySignature: text("razorpay_signature"),
    idempotencyKey: text("idempotency_key").unique(),
    billingDetails: jsonb("billing_details").default({}),
    notes: jsonb("notes").default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    paidAt: timestamp("paid_at"),
  },
  (table) => [
    index("idx_billing_orders_client").on(table.clientId),
    index("idx_billing_orders_razorpay_order").on(table.razorpayOrderId),
    index("idx_billing_orders_idempotency").on(table.idempotencyKey),
  ]
);

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    contactPhone: text("contact_phone"),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_support_tickets_email").on(table.email),
    index("idx_support_tickets_status").on(table.status),
  ]
);

export const messageTemplates = pgTable(
  "message_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    channel: messageChannelEnum("channel").notNull().default("sms"),
    category: templateCategoryEnum("category").notNull().default("transactional"),
    status: templateStatusEnum("status").notNull().default("approved"),
    body: text("body").notNull(),
    sampleVariables: jsonb("sample_variables").default({}),
    providerTemplateId: text("provider_template_id"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_message_templates_client").on(table.clientId),
    index("idx_message_templates_channel").on(table.channel),
    index("idx_message_templates_status").on(table.status),
  ]
);

export const messageThreads = pgTable(
  "message_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    channel: messageChannelEnum("channel").notNull().default("sms"),
    customerNumber: text("customer_number").notNull(),
    businessNumber: text("business_number").notNull(),
    lastMessageSnippet: text("last_message_snippet"),
    lastMessageAt: timestamp("last_message_at"),
    unreadCount: integer("unread_count").notNull().default(0),
    status: text("status").notNull().default("open"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_message_threads_client").on(table.clientId),
    index("idx_message_threads_contact").on(table.contactId),
    index("idx_message_threads_customer_number").on(table.customerNumber),
    index("idx_message_threads_last_message").on(table.lastMessageAt),
  ]
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    callId: uuid("call_id").references(() => calls.id, { onDelete: "set null" }),
    threadId: uuid("thread_id").references(() => messageThreads.id, { onDelete: "set null" }),
    templateId: uuid("template_id").references(() => messageTemplates.id, { onDelete: "set null" }),
    channel: messageChannelEnum("channel").notNull().default("sms"),
    direction: messageDirectionEnum("direction").notNull().default("outbound"),
    type: messageTypeEnum("type").notNull().default("post_call_followup"),
    status: messageStatusEnum("status").notNull().default("queued"),
    fromNumber: text("from_number").notNull(),
    toNumber: text("to_number").notNull(),
    body: text("body").notNull(),
    mediaUrls: text("media_urls").array(),
    providerMessageId: text("provider_message_id"),
    providerStatus: text("provider_status"),
    errorMessage: text("error_message"),
    errorCode: text("error_code"),
    numSegments: integer("num_segments").notNull().default(1),
    cost: real("cost"),
    currency: text("currency").notNull().default("USD"),
    metadata: jsonb("metadata").default({}),
    scheduledAt: timestamp("scheduled_at"),
    sentAt: timestamp("sent_at"),
    deliveredAt: timestamp("delivered_at"),
    failedAt: timestamp("failed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_messages_client").on(table.clientId),
    index("idx_messages_contact").on(table.contactId),
    index("idx_messages_call").on(table.callId),
    index("idx_messages_thread").on(table.threadId),
    index("idx_messages_status").on(table.status),
    index("idx_messages_provider_id").on(table.providerMessageId),
    index("idx_messages_created_at").on(table.createdAt),
  ]
);

export const messageDeliveryReceipts = pgTable(
  "message_delivery_receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("plivo"),
    rawStatus: text("raw_status").notNull(),
    payload: jsonb("payload").default({}),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_message_delivery_receipts_message").on(table.messageId),
    index("idx_message_delivery_receipts_provider").on(table.provider),
    index("idx_message_delivery_receipts_received_at").on(table.receivedAt),
  ]
);

export const messageOptOuts = pgTable(
  "message_opt_outs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    phoneNumber: text("phone_number").notNull(),
    channel: messageChannelEnum("channel").notNull().default("sms"),
    reason: text("reason").notNull().default("user_stop_request"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_message_opt_outs_client").on(table.clientId),
    index("idx_message_opt_outs_phone").on(table.phoneNumber),
    index("idx_message_opt_outs_channel").on(table.channel),
  ]
);
