CREATE TABLE "billing_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"user_id" uuid,
	"plan_id" text NOT NULL,
	"plan_name" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"credits_granted" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"method" text,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"razorpay_signature" text,
	"idempotency_key" text,
	"billing_details" jsonb DEFAULT '{}'::jsonb,
	"notes" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"paid_at" timestamp,
	CONSTRAINT "billing_orders_razorpay_order_id_unique" UNIQUE("razorpay_order_id"),
	CONSTRAINT "billing_orders_razorpay_payment_id_unique" UNIQUE("razorpay_payment_id"),
	CONSTRAINT "billing_orders_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_orders" ADD CONSTRAINT "billing_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_billing_orders_client" ON "billing_orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_billing_orders_razorpay_order" ON "billing_orders" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE INDEX "idx_billing_orders_idempotency" ON "billing_orders" USING btree ("idempotency_key");