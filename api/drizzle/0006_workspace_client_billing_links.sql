ALTER TABLE "billing_orders" ADD COLUMN "workspace_client_id" uuid REFERENCES "workspace_records"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD COLUMN "workspace_client_id" uuid REFERENCES "workspace_records"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX "billing_orders_org_workspace_client_idx" ON "billing_orders" USING btree ("organization_id", "workspace_client_id");
--> statement-breakpoint
CREATE INDEX "billing_subscriptions_org_workspace_client_idx" ON "billing_subscriptions" USING btree ("organization_id", "workspace_client_id");
--> statement-breakpoint
UPDATE "billing_orders" AS b SET "workspace_client_id" = c.id FROM "workspace_records" AS c
WHERE c.organization_id = b.organization_id AND c.resource = 'clients' AND c.archived_at IS NULL
  AND lower(trim(coalesce(c.data->>'name', c.data->>'title', ''))) = lower(trim(b.client_name))
  AND (SELECT count(*) FROM "workspace_records" AS m WHERE m.organization_id = b.organization_id AND m.resource = 'clients' AND m.archived_at IS NULL AND lower(trim(coalesce(m.data->>'name', m.data->>'title', ''))) = lower(trim(b.client_name))) = 1;
--> statement-breakpoint
UPDATE "billing_subscriptions" AS b SET "workspace_client_id" = c.id FROM "workspace_records" AS c
WHERE c.organization_id = b.organization_id AND c.resource = 'clients' AND c.archived_at IS NULL
  AND lower(trim(coalesce(c.data->>'name', c.data->>'title', ''))) = lower(trim(b.client_name))
  AND (SELECT count(*) FROM "workspace_records" AS m WHERE m.organization_id = b.organization_id AND m.resource = 'clients' AND m.archived_at IS NULL AND lower(trim(coalesce(m.data->>'name', m.data->>'title', ''))) = lower(trim(b.client_name))) = 1;
