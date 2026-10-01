import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('adds tenant-validated workspace customer links to orders and subscriptions incrementally', async () => {
  const migration = await readFile(new URL('../drizzle/0006_workspace_client_billing_links.sql', import.meta.url), 'utf8');
  assert.match(migration, /ALTER TABLE "billing_orders" ADD COLUMN "workspace_client_id" uuid REFERENCES "workspace_records"/);
  assert.match(migration, /ALTER TABLE "billing_subscriptions" ADD COLUMN "workspace_client_id" uuid REFERENCES "workspace_records"/);
  assert.match(migration, /billing_orders_org_workspace_client_idx/);
  assert.match(migration, /billing_subscriptions_org_workspace_client_idx/);
  assert.match(migration, /count\(\*\).* = 1/s);
  assert.doesNotMatch(migration, /CREATE TABLE "billing_orders"/);
});
