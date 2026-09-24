CREATE INDEX "billing_orders_pending_due_idx" ON "billing_orders" USING btree ("status", "due_at");
--> statement-breakpoint
CREATE TABLE "billing_overdue_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"billing_order_id" uuid NOT NULL REFERENCES "billing_orders"("id") ON DELETE CASCADE,
	"event_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"discarded_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_overdue_events_order_unique" ON "billing_overdue_events" USING btree ("billing_order_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_overdue_events_event_unique" ON "billing_overdue_events" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX "billing_overdue_events_retry_idx" ON "billing_overdue_events" USING btree ("delivered_at", "discarded_at", "next_attempt_at");
