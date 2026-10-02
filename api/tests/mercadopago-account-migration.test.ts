import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('provider seller identity migration adds nullable fields without rewriting billing history', async () => {
  const sql = await readFile(new URL('../drizzle/0010_billing_provider_account.sql', import.meta.url), 'utf8');
  assert.match(sql, /ALTER TABLE billing_orders\s+ADD COLUMN IF NOT EXISTS mercado_pago_account_id text/i);
  assert.match(sql, /ALTER TABLE billing_subscriptions\s+ADD COLUMN IF NOT EXISTS mercado_pago_account_id text/i);
  assert.doesNotMatch(sql, /UPDATE\s+|DROP\s+|NOT NULL/i);
});
