ALTER TABLE "billing_orders" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone;
--> statement-breakpoint
ALTER TABLE "billing_orders" ALTER COLUMN "updated_at" SET DEFAULT now();
--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ALTER COLUMN "updated_at" SET DATA TYPE timestamp (3) with time zone;
--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ALTER COLUMN "updated_at" SET DEFAULT now();
