CREATE TYPE "public"."contact_status" AS ENUM('pending', 'queued', 'in_progress', 'completed', 'do_not_call', 'invalid');--> statement-breakpoint
CREATE TYPE "public"."upload_status" AS ENUM('processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"upload_batch_id" uuid,
	"parent_name" text,
	"student_name" text,
	"phone_number" text NOT NULL,
	"phone_number_raw" text,
	"course_or_stream" text,
	"custom_fields" jsonb,
	"status" "contact_status" DEFAULT 'pending' NOT NULL,
	"is_duplicate_of" uuid,
	"opt_out" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"uploaded_by" uuid,
	"total_rows" integer,
	"valid_rows" integer,
	"invalid_rows" integer,
	"duplicate_rows" integer,
	"status" "upload_status" DEFAULT 'processing' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_upload_batch_id_upload_batches_id_fk" FOREIGN KEY ("upload_batch_id") REFERENCES "public"."upload_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_batches" ADD CONSTRAINT "upload_batches_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_batches" ADD CONSTRAINT "upload_batches_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;