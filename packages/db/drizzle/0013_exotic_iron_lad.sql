CREATE TABLE "email_verification_otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"user_id" uuid,
	"otp_hash" text NOT NULL,
	"purpose" text DEFAULT 'auth_verification' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_verification_otps" ADD CONSTRAINT "email_verification_otps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_email_verification_otps_email" ON "email_verification_otps" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_email_verification_otps_purpose" ON "email_verification_otps" USING btree ("purpose");