CREATE TYPE "public"."queue_status" AS ENUM('pending', 'in_progress', 'completed', 'failed', 'exhausted');--> statement-breakpoint
CREATE TABLE "call_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"status" "queue_status" DEFAULT 'pending' NOT NULL,
	"max_attempts" integer DEFAULT 2 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call_queue" ADD CONSTRAINT "call_queue_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_queue" ADD CONSTRAINT "call_queue_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;