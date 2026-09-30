CREATE TABLE "n8n_event_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"automation_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"event_key" text NOT NULL,
	"record" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"discarded_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "n8n_delivery_automation_event_unique" ON "n8n_event_deliveries" USING btree ("automation_id", "event_id");
--> statement-breakpoint
CREATE INDEX "n8n_event_deliveries_retry_idx" ON "n8n_event_deliveries" USING btree ("delivered_at", "discarded_at", "next_attempt_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_task_n8n_event_unique" ON "workspace_records" USING btree ("organization_id", (("data" ->> 'n8nEventId')))
WHERE "resource" = 'tasks' AND "archived_at" IS NULL AND "data" ? 'n8nEventId';
