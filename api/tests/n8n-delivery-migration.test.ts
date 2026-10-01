import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { n8nDeliveryCanRetry } from '../src/integrations/n8n-delivery.ts';

test('manually retries only discarded, undelivered events whose payload was retained', () => {
  const discardedAt = new Date();
  assert.equal(n8nDeliveryCanRetry({ discardedAt, deliveredAt: null, record: { clientName: 'Cliente' } }), true);
  assert.equal(n8nDeliveryCanRetry({ discardedAt: null, deliveredAt: null, record: { clientName: 'Cliente' } }), false);
  assert.equal(n8nDeliveryCanRetry({ discardedAt, deliveredAt: new Date(), record: { clientName: 'Cliente' } }), false);
  assert.equal(n8nDeliveryCanRetry({ discardedAt, deliveredAt: null, record: {} }), false);
});

test('n8n delivery outbox migration is journaled with idempotency and retry indexes', async () => {
  const migration = await readFile(new URL('../drizzle/0005_n8n_event_deliveries.sql', import.meta.url), 'utf8');
  const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')) as {
    entries: Array<{ idx: number; tag: string }>;
  };

  assert.match(migration, /CREATE TABLE "n8n_event_deliveries"/);
  assert.match(migration, /n8n_delivery_automation_event_unique/);
  assert.match(migration, /n8n_event_deliveries_retry_idx/);
  assert.match(migration, /workspace_task_n8n_event_unique/);
  const entry = journal.entries.find((item) => item.tag === '0005_n8n_event_deliveries');
  assert.equal(entry?.idx, 5);
});
