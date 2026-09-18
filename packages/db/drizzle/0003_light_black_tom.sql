CREATE TYPE "public"."call_outcome" AS ENUM('connected', 'no_answer', 'busy', 'voicemail', 'dropped_early', 'failed');--> statement-breakpoint
CREATE TYPE "public"."interest_level" AS ENUM('high', 'medium', 'low', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('positive', 'neutral', 'negative');--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"queue_entry_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"duration_seconds" integer,
	"outcome" "call_outcome" NOT NULL,
	"is_billable" boolean DEFAULT false NOT NULL,
	"credits_charged" integer DEFAULT 0 NOT NULL,
	"recording_url" text,
	"transcript" jsonb,
	"interest_level" "interest_level",
	"objections_raised" text[],
	"follow_up_requested" boolean DEFAULT false NOT NULL,
	"sentiment" "sentiment",
	"knowledge_base_version_used" integer,
	"cost_telephony" real,
	"cost_stt" real,
	"cost_llm" real,
	"cost_tts" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_queue_entry_id_call_queue_id_fk" FOREIGN KEY ("queue_entry_id") REFERENCES "public"."call_queue"("id") ON DELETE no action ON UPDATE no action;