CREATE TYPE "public"."message_channel" AS ENUM('sms', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('queued', 'sending', 'sent', 'delivered', 'undelivered', 'failed', 'received');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('post_call_followup', 'campaign_outreach', 'manual_direct', 'system_alert', 'inbound_reply');--> statement-breakpoint
CREATE TYPE "public"."template_category" AS ENUM('utility', 'marketing', 'authentication', 'transactional');--> statement-breakpoint
CREATE TYPE "public"."template_status" AS ENUM('draft', 'pending_approval', 'approved', 'rejected', 'disabled');--> statement-breakpoint
CREATE TABLE "message_delivery_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"provider" text DEFAULT 'plivo' NOT NULL,
	"raw_status" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_opt_outs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"phone_number" text NOT NULL,
	"channel" "message_channel" DEFAULT 'sms' NOT NULL,
	"reason" text DEFAULT 'user_stop_request' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"channel" "message_channel" DEFAULT 'sms' NOT NULL,
	"category" "template_category" DEFAULT 'transactional' NOT NULL,
	"status" "template_status" DEFAULT 'approved' NOT NULL,
	"body" text NOT NULL,
	"sample_variables" jsonb DEFAULT '{}'::jsonb,
	"provider_template_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"contact_id" uuid,
	"channel" "message_channel" DEFAULT 'sms' NOT NULL,
	"customer_number" text NOT NULL,
	"business_number" text NOT NULL,
	"last_message_snippet" text,
	"last_message_at" timestamp,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"contact_id" uuid,
	"call_id" uuid,
	"thread_id" uuid,
	"template_id" uuid,
	"channel" "message_channel" DEFAULT 'sms' NOT NULL,
	"direction" "message_direction" DEFAULT 'outbound' NOT NULL,
	"type" "message_type" DEFAULT 'post_call_followup' NOT NULL,
	"status" "message_status" DEFAULT 'queued' NOT NULL,
	"from_number" text NOT NULL,
	"to_number" text NOT NULL,
	"body" text NOT NULL,
	"media_urls" text[],
	"provider_message_id" text,
	"provider_status" text,
	"error_message" text,
	"error_code" text,
	"num_segments" integer DEFAULT 1 NOT NULL,
	"cost" real,
	"currency" text DEFAULT 'USD' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"failed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_delivery_receipts" ADD CONSTRAINT "message_delivery_receipts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_opt_outs" ADD CONSTRAINT "message_opt_outs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_call_id_calls_id_fk" FOREIGN KEY ("call_id") REFERENCES "public"."calls"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_message_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."message_threads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_template_id_message_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."message_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_message_delivery_receipts_message" ON "message_delivery_receipts" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_message_delivery_receipts_provider" ON "message_delivery_receipts" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "idx_message_delivery_receipts_received_at" ON "message_delivery_receipts" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "idx_message_opt_outs_client" ON "message_opt_outs" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_message_opt_outs_phone" ON "message_opt_outs" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "idx_message_opt_outs_channel" ON "message_opt_outs" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "idx_message_templates_client" ON "message_templates" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_message_templates_channel" ON "message_templates" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "idx_message_templates_status" ON "message_templates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_message_threads_client" ON "message_threads" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_message_threads_contact" ON "message_threads" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_message_threads_customer_number" ON "message_threads" USING btree ("customer_number");--> statement-breakpoint
CREATE INDEX "idx_message_threads_last_message" ON "message_threads" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "idx_messages_client" ON "messages" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_messages_contact" ON "messages" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "idx_messages_call" ON "messages" USING btree ("call_id");--> statement-breakpoint
CREATE INDEX "idx_messages_thread" ON "messages" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "idx_messages_status" ON "messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_messages_provider_id" ON "messages" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "idx_messages_created_at" ON "messages" USING btree ("created_at");