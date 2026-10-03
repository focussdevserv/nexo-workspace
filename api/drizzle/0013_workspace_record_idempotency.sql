ALTER TABLE workspace_records
  ADD COLUMN IF NOT EXISTS create_idempotency_key text,
  ADD COLUMN IF NOT EXISTS create_request_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS workspace_records_org_resource_create_key_unique
  ON workspace_records (organization_id, resource, create_idempotency_key)
  WHERE create_idempotency_key IS NOT NULL;
