CREATE TYPE "public"."client_status" AS ENUM('trialing', 'active', 'paused', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."plan_tier" AS ENUM('trial', 'starter', 'growth', 'pro', 'scale');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('client_admin', 'client_viewer', 'internal_admin');--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact_person_name" text,
	"contact_email" text,
	"contact_phone" text,
	"caller_id_number" text,
	"calling_hours_start" time DEFAULT '09:00:00',
	"calling_hours_end" time DEFAULT '16:00:00',
	"timezone" text DEFAULT 'Asia/Kolkata' NOT NULL,
	"plan_tier" "plan_tier" DEFAULT 'trial' NOT NULL,
	"monthly_credit_allowance" integer DEFAULT 360 NOT NULL,
	"credits_used_this_cycle" integer DEFAULT 0 NOT NULL,
	"plan_started_at" timestamp,
	"next_billing_reset_at" timestamp,
	"trial_ends_at" timestamp,
	"status" "client_status" DEFAULT 'trialing' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;