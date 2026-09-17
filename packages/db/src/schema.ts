import { pgTable, uuid, text, integer, timestamp, time, pgEnum } from "drizzle-orm/pg-core";


//enum
export const planTierEnum = pgEnum('plan_tier', ['trial', 'starter', 'growth', 'pro', 'scale']);
export const clientStatusEnum = pgEnum('client_status', ['trialing', 'active', 'paused', 'suspended']);
export const userRoleEnum = pgEnum('user_role', ['client_admin', 'client_viewer', 'internal_admin']);
export const tiersCredits = pgEnum('plan_credits', ['100', '500', '1000', '1500', '2000']);