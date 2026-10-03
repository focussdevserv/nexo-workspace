ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS request_idempotency_key text;
ALTER TABLE billing_orders ADD COLUMN IF NOT EXISTS request_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS billing_orders_org_request_key_unique
  ON billing_orders (organization_id, request_idempotency_key);

ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS request_idempotency_key text;
ALTER TABLE billing_subscriptions ADD COLUMN IF NOT EXISTS request_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS billing_subscriptions_org_request_key_unique
  ON billing_subscriptions (organization_id, request_idempotency_key);
