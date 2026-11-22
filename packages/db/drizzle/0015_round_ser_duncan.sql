CREATE TYPE "public"."recording_status" AS ENUM('in_progress', 'completed', 'failed', 'deleted');--> statement-breakpoint
CREATE TABLE "call_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"call_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"plivo_recording_id" text,
	"source_url" text NOT NULL,
	"duration_seconds" integer,
	"file_format" text DEFAULT 'mp3' NOT NULL,
	"file_size_bytes" integer,
	"status" "recording_status" DEFAULT 'completed' NOT NULL,
	"channels" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "call_recordings" ADD CONSTRAINT "call_recordings_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_recordings" ADD CONSTRAINT "call_recordings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_call_recordings_call_id" ON "call_recordings" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "idx_call_recordings_client_id" ON "call_recordings" USING btree ("client_id");