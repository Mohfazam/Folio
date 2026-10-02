CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'active', 'paused', 'completed');--> statement-breakpoint
CREATE TYPE "public"."campaign_type" AS ENUM('outreach_sales', 'follow_up', 'reminder', 'reactivation', 'feedback_survey', 'announcement');--> statement-breakpoint
CREATE TYPE "public"."industry_type" AS ENUM('education', 'beauty_wellness', 'healthcare', 'real_estate', 'automotive', 'fitness', 'professional_services', 'retail', 'general');--> statement-breakpoint
CREATE TABLE "business_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"industry" "industry_type" DEFAULT 'general' NOT NULL,
	"display_name" text NOT NULL,
	"tagline" text,
	"description" text NOT NULL,
	"website" text,
	"address" text,
	"operating_hours" text,
	"support_phone" text,
	"catalog_offerings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tone_of_voice" text DEFAULT 'Warm, professional, helpful, and concise' NOT NULL,
	"ai_persona_name" text DEFAULT 'Assistant',
	"guardrails" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "business_profiles_client_id_unique" UNIQUE("client_id")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "campaign_type" DEFAULT 'outreach_sales' NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"primary_objective" text NOT NULL,
	"call_opening_hook" text NOT NULL,
	"key_talking_points" text[] NOT NULL,
	"objection_handlers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"call_to_action" text NOT NULL,
	"fallback_offer" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calls" ALTER COLUMN "queue_entry_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "call_queue" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "campaign_id" uuid;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "full_name" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "secondary_name" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "context_data" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_queue" ADD CONSTRAINT "call_queue_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;