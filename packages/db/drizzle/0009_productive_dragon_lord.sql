ALTER TYPE "public"."industry_type" ADD VALUE 'saas_software' BEFORE 'education';--> statement-breakpoint
ALTER TYPE "public"."industry_type" ADD VALUE 'developer_tools' BEFORE 'education';--> statement-breakpoint
ALTER TYPE "public"."industry_type" ADD VALUE 'fintech' BEFORE 'education';--> statement-breakpoint
ALTER TYPE "public"."industry_type" ADD VALUE 'ai_cloud' BEFORE 'education';--> statement-breakpoint
ALTER TYPE "public"."industry_type" ADD VALUE 'healthtech' BEFORE 'education';--> statement-breakpoint
ALTER TYPE "public"."industry_type" ADD VALUE 'ecommerce_retail' BEFORE 'education';--> statement-breakpoint
ALTER TYPE "public"."industry_type" ADD VALUE 'cybersecurity' BEFORE 'education';--> statement-breakpoint
ALTER TABLE "knowledge_base_entries" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."kb_entry_type";--> statement-breakpoint
CREATE TYPE "public"."kb_entry_type" AS ENUM('faq', 'product_feature', 'pricing_plan', 'technical_spec', 'troubleshooting', 'integration_guide', 'competitor_comparison', 'case_study', 'policy_legal', 'document', 'course_info', 'fee', 'deadline', 'policy');--> statement-breakpoint
ALTER TABLE "knowledge_base_entries" ALTER COLUMN "type" SET DATA TYPE "public"."kb_entry_type" USING "type"::"public"."kb_entry_type";--> statement-breakpoint
ALTER TABLE "audit_log" ALTER COLUMN "metadata" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "business_profiles" ALTER COLUMN "tone_of_voice" SET DEFAULT 'Warm, professional, knowledgeable, and concise';--> statement-breakpoint
ALTER TABLE "contacts" ALTER COLUMN "custom_fields" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD COLUMN "key_differentiators" text[];--> statement-breakpoint
ALTER TABLE "business_profiles" ADD COLUMN "compliance_notes" text;--> statement-breakpoint
ALTER TABLE "business_profiles" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "call_queue" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "call_queue" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "contact_name" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "phone_number" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "summary" text;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "key_action_items" text[];--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "cost_total" real;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "target_audience" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "language" text DEFAULT 'en-IN';--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "max_duration_seconds" integer DEFAULT 300;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "company_name" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "job_title" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "department" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "industry" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "timezone" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "lead_score" integer;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "lifecycle_stage" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "account_tier" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "tags" text[];--> statement-breakpoint
ALTER TABLE "follow_ups" ADD COLUMN "type" text DEFAULT 'call_back' NOT NULL;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD COLUMN "priority" text DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "follow_ups" ADD COLUMN "due_date" timestamp;--> statement-breakpoint
ALTER TABLE "knowledge_base_entries" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "knowledge_base_entries" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "knowledge_base_entries" ADD COLUMN "tags" text[];--> statement-breakpoint
ALTER TABLE "knowledge_base_entries" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "knowledge_base_entries" ADD COLUMN "priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "knowledge_base_entries" ADD COLUMN "target_personas" text[];