CREATE TYPE "public"."kb_entry_type" AS ENUM('faq', 'course_info', 'fee', 'deadline', 'policy', 'document');--> statement-breakpoint
CREATE TABLE "knowledge_base_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"type" "kb_entry_type" NOT NULL,
	"question" text,
	"content" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calls" ALTER COLUMN "is_billable" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "knowledge_base_entries" ADD CONSTRAINT "knowledge_base_entries_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;