ALTER TABLE "clients" ADD COLUMN "max_calls_per_day" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "calls_made_today" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "calls_made_today_reset_at" timestamp;