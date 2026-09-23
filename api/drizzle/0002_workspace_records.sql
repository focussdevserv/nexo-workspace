CREATE TABLE "workspace_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
	"resource" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "workspace_records_org_resource_updated_idx" ON "workspace_records" USING btree ("organization_id","resource","updated_at");
--> statement-breakpoint
CREATE INDEX "workspace_records_org_resource_created_idx" ON "workspace_records" USING btree ("organization_id","resource","created_at");
