import { pgTable, uuid, text, integer, timestamp, time, pgEnum } from "drizzle-orm/pg-core";


//enum
export const planTierEnum = pgEnum('plan_tier', ['starter', 'growth', 'pro', 'scale']);
export const clientStatusEnum = pgEnum('client_status', ['pending', 'active', 'paused', 'suspended']);
export const userRoleEnum = pgEnum('user_role', ['client_admin', 'client_viewer', 'internal_admin']);