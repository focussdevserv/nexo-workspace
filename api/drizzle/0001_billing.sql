CREATE TABLE "billing_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"client_id" uuid REFERENCES "clients"("id") ON DELETE SET NULL,
	"created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"client_name" text NOT NULL,
	"payer_email" text NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"status_detail" text,
	"mp_order_id" text,
	"mp_payment_id" text,
	"payment_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"client_id" uuid REFERENCES "clients"("id") ON DELETE SET NULL,
	"created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"client_name" text NOT NULL,
	"payer_email" text NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"frequency" text NOT NULL,
	"frequency_interval" numeric(6, 0) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"mp_subscription_id" text,
	"checkout_url" text,
	"next_payment_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "billing_orders_org_created_idx" ON "billing_orders" USING btree ("organization_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_orders_mp_order_unique" ON "billing_orders" USING btree ("mp_order_id");
--> statement-breakpoint
CREATE INDEX "billing_subscriptions_org_created_idx" ON "billing_subscriptions" USING btree ("organization_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_subscriptions_mp_id_unique" ON "billing_subscriptions" USING btree ("mp_subscription_id");
