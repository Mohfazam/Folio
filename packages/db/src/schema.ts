import { pgTable, uuid, text, integer, timestamp, time, pgEnum } from "drizzle-orm/pg-core";import { jsonb, boolean } from "drizzle-orm/pg-core";




//enum
export const planTierEnum = pgEnum('plan_tier', ['trial', 'starter', 'growth', 'pro', 'scale']);
export const clientStatusEnum = pgEnum('client_status', ['trialing', 'active', 'paused', 'suspended']);
export const userRoleEnum = pgEnum('user_role', ['client_admin', 'client_viewer', 'internal_admin']);
export const uploadStatusEnum = pgEnum('upload_status', ['processing', 'completed', 'failed']);
export const contactStatusEnum = pgEnum('contact_status', ['pending', 'queued', 'in_progress', 'completed', 'do_not_call', 'invalid']);




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
    planStartedAt: timestamp('plan_started_at'),
    nextBillingResetAt: timestamp('next_billing_reset_at'),
    trialEndsAt: timestamp('trial_ends_at'),
    status: clientStatusEnum('status').notNull().default('trialing'),
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
  parentName: text('parent_name'),
  studentName: text('student_name'),
  phoneNumber: text('phone_number').notNull(), // normalized, e.g. +91XXXXXXXXXX
  phoneNumberRaw: text('phone_number_raw'), // exactly what was in the uploaded file, before cleanup
  courseOrStream: text('course_or_stream'),
  customFields: jsonb('custom_fields'), // catch-all for whatever extra columns a client's file has
  status: contactStatusEnum('status').notNull().default('pending'),
  isDuplicateOf: uuid('is_duplicate_of'), // self-reference
  optOut: boolean('opt_out').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});