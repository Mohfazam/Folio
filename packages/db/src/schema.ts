import { pgTable, uuid, text, integer, timestamp, time, pgEnum } from "drizzle-orm/pg-core";


//enum
export const planTierEnum = pgEnum('plan_tier', ['trial', 'starter', 'growth', 'pro', 'scale']);
export const clientStatusEnum = pgEnum('client_status', ['trialing', 'active', 'paused', 'suspended']);
export const userRoleEnum = pgEnum('user_role', ['client_admin', 'client_viewer', 'internal_admin']);


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