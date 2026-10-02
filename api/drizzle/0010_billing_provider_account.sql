ALTER TABLE billing_orders
  ADD COLUMN IF NOT EXISTS mercado_pago_account_id text;

ALTER TABLE billing_subscriptions
  ADD COLUMN IF NOT EXISTS mercado_pago_account_id text;
