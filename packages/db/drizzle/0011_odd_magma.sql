ALTER TABLE "call_queue" ADD COLUMN "reserved_credits" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "credits_reserved_this_cycle" integer DEFAULT 0 NOT NULL;