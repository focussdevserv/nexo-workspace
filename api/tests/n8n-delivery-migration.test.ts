import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('n8n delivery outbox migration is journaled with idempotency and retry indexes', async () => {
  const migration = await readFile(new URL('../drizzle/0005_n8n_event_deliveries.sql', import.meta.url), 'utf8');
  const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')) as {
    entries: Array<{ idx: number; tag: string }>;
  };

  assert.match(migration, /CREATE TABLE "n8n_event_deliveries"/);
  assert.match(migration, /n8n_delivery_automation_event_unique/);
  assert.match(migration, /n8n_event_deliveries_retry_idx/);
  assert.match(migration, /workspace_task_n8n_event_unique/);
  assert.equal(journal.entries.at(-1)?.idx, 5);
  assert.equal(journal.entries.at(-1)?.tag, '0005_n8n_event_deliveries');
});
