import { pgTable, uuid, text, integer, timestamp, time, pgEnum } from "drizzle-orm/pg-core";
import { jsonb, boolean } from "drizzle-orm/pg-core";
import { real } from "drizzle-orm/pg-core";




//enum
export const planTierEnum = pgEnum('plan_tier', ['trial', 'starter', 'growth', 'pro', 'scale']);

export const clientStatusEnum = pgEnum('client_status', ['trialing', 'active', 'paused', 'suspended']);

export const userRoleEnum = pgEnum('user_role', ['client_admin', 'client_viewer', 'internal_admin']);

export const uploadStatusEnum = pgEnum('upload_status', ['processing', 'completed', 'failed']);

export const contactStatusEnum = pgEnum('contact_status', ['pending', 'queued', 'in_progress', 'completed', 'do_not_call', 'invalid']);

export const queueStatusEnum = pgEnum('queue_status', ['pending', 'in_progress', 'completed', 'failed', 'exhausted']);



//calls

export const callOutcomeEnum = pgEnum('call_outcome', ['connected', 'no_answer', 'busy', 'voicemail', 'dropped_early', 'failed']);
export const interestLevelEnum = pgEnum('interest_level', ['high', 'medium', 'low', 'unknown']);
export const sentimentEnum = pgEnum('sentiment', ['positive', 'neutral', 'negative']);

//folloups
export const followUpStatusEnum = pgEnum('follow_up_status', ['open', 'done', 'not_needed']);

//knowledgebase
export const kbEntryTypeEnum = pgEnum('kb_entry_type', ['faq', 'course_info', 'fee', 'deadline', 'policy', 'document']);

//multi-industry & campaign enums
export const industryTypeEnum = pgEnum('industry_type', [
  'education',
  'beauty_wellness',
  'healthcare',
  'real_estate',
  'automotive',
  'fitness',
  'professional_services',
  'retail',
  'general'
]);

export const campaignTypeEnum = pgEnum('campaign_type', [
  'outreach_sales',
  'follow_up',
  'reminder',
  'reactivation',
  'feedback_survey',
  'announcement'
]);

export const campaignStatusEnum = pgEnum('campaign_status', [
  'draft',
  'active',
  'paused',
  'completed'
]);



export const clients = pgTable('clients', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    contactPersonName: text('contact_person_name'),
    contactEmail: text('contact_email'),
    contactPhone: text('contact_phone'),
    callerIdNumber: text('caller_id_number'),
    callingHoursStart: time('calling_hours_start').default('09:00:00'),
    callingHoursEnd: time('calling_hours_end').default('16:00:00'),
    timezone: text('timezone').notNull().default('Asia/Kolkata'),
    planTier: planTierEnum('plan_tier').notNull().default('trial'),
    monthlyCreditsAllowance: integer('monthly_credit_allowance').notNull().default(360),
    creditsUsedThisCycle: integer('credits_used_this_cycle').notNull().default(0),
    maxCallsPerDay: integer('max_calls_per_day').notNull().default(50),
    callsMadeToday: integer('calls_made_today').notNull().default(0),
    callsMadeTodayResetAt: timestamp('calls_made_today_reset_at'),
    planStartedAt: timestamp('plan_started_at'),
    nextBillingResetAt: timestamp('next_billing_reset_at'),
    trialEndsAt: timestamp('trial_ends_at'),
    status: clientStatusEnum('status').notNull().default('trialing'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),

});

export const businessProfiles = pgTable('business_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }).unique(),
  industry: industryTypeEnum('industry').notNull().default('general'),
  displayName: text('display_name').notNull(),
  tagline: text('tagline'),
  description: text('description').notNull(),
  website: text('website'),
  address: text('address'),
  operatingHours: text('operating_hours'),
  supportPhone: text('support_phone'),
  catalogOfferings: jsonb('catalog_offerings').notNull().default([]),
  toneOfVoice: text('tone_of_voice').notNull().default('Warm, professional, helpful, and concise'),
  aiPersonaName: text('ai_persona_name').default('Assistant'),
  guardrails: text('guardrails').array(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: campaignTypeEnum('type').notNull().default('outreach_sales'),
  status: campaignStatusEnum('status').notNull().default('draft'),
  primaryObjective: text('primary_objective').notNull(),
  callOpeningHook: text('call_opening_hook').notNull(),
  keyTalkingPoints: text('key_talking_points').array().notNull(),
  objectionHandlers: jsonb('objection_handlers').notNull().default([]),
  callToAction: text('call_to_action').notNull(),
  fallbackOffer: text('fallback_offer'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id), // nullable — internal_admin users have no client
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});


export const uploadBatches = pgTable('upload_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  filename: text('filename').notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  totalRows: integer('total_rows'),
  validRows: integer('valid_rows'),
  invalidRows: integer('invalid_rows'),
  duplicateRows: integer('duplicate_rows'),
  status: uploadStatusEnum('status').notNull().default('processing'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  uploadBatchId: uuid('upload_batch_id').references(() => uploadBatches.id),
  fullName: text('full_name'),
  secondaryName: text('secondary_name'),
  phoneNumber: text('phone_number').notNull(), // normalized, e.g. +91XXXXXXXXXX
  phoneNumberRaw: text('phone_number_raw'), // exactly what was in the uploaded file, before cleanup
  email: text('email'),
  parentName: text('parent_name'),
  studentName: text('student_name'),
  courseOrStream: text('course_or_stream'),
  contextData: jsonb('context_data').default({}),
  customFields: jsonb('custom_fields'), // catch-all for whatever extra columns a client's file has
  status: contactStatusEnum('status').notNull().default('pending'),
  isDuplicateOf: uuid('is_duplicate_of'), // self-reference
  optOut: boolean('opt_out').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const callQueue = pgTable('call_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').notNull().references(() => contacts.id),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  campaignId: uuid('campaign_id').references(() => campaigns.id),
  scheduledFor: timestamp('scheduled_for').notNull(),
  attemptNumber: integer('attempt_number').notNull().default(1),
  priority: integer('priority').notNull().default(0),
  status: queueStatusEnum('status').notNull().default('pending'),
  maxAttempts: integer('max_attempts').notNull().default(2),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});



export const calls = pgTable('calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  contactId: uuid('contact_id').notNull().references(() => contacts.id),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  campaignId: uuid('campaign_id').references(() => campaigns.id),
  queueEntryId: uuid('queue_entry_id').references(() => callQueue.id),
  attemptNumber: integer('attempt_number').notNull(),
  startedAt: timestamp('started_at').notNull(),
  endedAt: timestamp('ended_at'),
  durationSeconds: integer('duration_seconds'),
  outcome: callOutcomeEnum('outcome').notNull(),
  isBillable: boolean('is_billable').notNull().default(true), 
  creditsCharged: integer('credits_charged').notNull().default(0), // duration in 10-sec units, ceild
  recordingUrl: text('recording_url'),
  transcript: jsonb('transcript'), // array of { speaker: 'ai' | 'parent', text, timestamp }
  interestLevel: interestLevelEnum('interest_level'),
  objectionsRaised: text('objections_raised').array(),
  followUpRequested: boolean('follow_up_requested').notNull().default(false),
  sentiment: sentimentEnum('sentiment'),
  knowledgeBaseVersionUsed: integer('knowledge_base_version_used'),
  costTelephony: real('cost_telephony'),
  costStt: real('cost_stt'),
  costLlm: real('cost_llm'),
  costTts: real('cost_tts'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});


export const followUps = pgTable('follow_ups', {
  id: uuid('id').primaryKey().defaultRandom(),
  callId: uuid('call_id').notNull().references(() => calls.id),
  contactId: uuid('contact_id').notNull().references(() => contacts.id),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  requestedCallbackTime: timestamp('requested_callback_time'),
  assignedTo: uuid('assigned_to').references(() => users.id),
  status: followUpStatusEnum('status').notNull().default('open'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});


export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id),
  userId: uuid('user_id').references(() => users.id),
  action: text('action').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});


export const knowledgeBaseEntries = pgTable('knowledge_base_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').notNull().references(() => clients.id),
  type: kbEntryTypeEnum('type').notNull(),
  question: text('question'),
  content: text('content').notNull(),
  version: integer('version').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});