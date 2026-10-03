import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { financeEntryIdempotencyDecision, financeEntryRequestFingerprint } from '../src/finance/entry-idempotency.ts';

test('finance entry fingerprints ignore generated codes and object key order but detect changed financial details', () => {
  const first = financeEntryRequestFingerprint({ data: { description: 'Hospedagem', amount: 120, code: 'REC-11111', clientId: null } });
  const retry = financeEntryRequestFingerprint({ data: { clientId: null, code: 'REC-22222', amount: 120, description: 'Hospedagem' } });
  const changed = financeEntryRequestFingerprint({ data: { description: 'Hospedagem', amount: 125, code: 'REC-33333', clientId: null } });
  assert.equal(retry, first);
  assert.notEqual(changed, first);
  assert.equal(financeEntryIdempotencyDecision(first, retry), 'replay');
  assert.equal(financeEntryIdempotencyDecision(first, changed), 'conflict');
});

test('recurrence fingerprints include frequency and count but ignore per-record recurrence metadata', () => {
  const input = { data: { description: 'Mensalidade', amount: 89.9, date: '2026-10-01', code: 'old' }, frequency: 'monthly', count: 12 };
  const stored = { data: { description: 'Mensalidade', amount: 89.9, date: '2026-10-01', code: 'generated', recurrenceSeriesId: 'series', recurrenceFrequency: 'monthly', recurrenceSequence: 1, recurrenceCount: 12 }, frequency: 'monthly', count: 12 };
  assert.equal(financeEntryRequestFingerprint(input), financeEntryRequestFingerprint(stored));
  assert.notEqual(financeEntryRequestFingerprint(input), financeEntryRequestFingerprint({ ...input, count: 10 }));
  assert.notEqual(financeEntryRequestFingerprint(input), financeEntryRequestFingerprint({ ...input, frequency: 'quarterly' }));
});

test('financial create route and recurring route lock request keys and return replays without inserting again', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const createStart = source.indexOf("app.post('/api/workspace/:resource'");
  const createEnd = source.indexOf("app.patch('/api/workspace/:resource/:id'", createStart);
  const recurringStart = source.indexOf("app.post('/api/workspace/:resource/recurring'");
  const recurringEnd = source.indexOf("app.post('/api/workspace/tasks/:id/complete-occurrence'", recurringStart);
  const createRoute = source.slice(createStart, createEnd);
  const recurringRoute = source.slice(recurringStart, recurringEnd);
  assert.match(createRoute, /request\.headers\['idempotency-key'\]/);
  assert.match(createRoute, /createIdempotencyKey/);
  assert.match(createRoute, /financeEntryRequestFingerprint/);
  assert.match(createRoute, /finance_entry_idempotency_conflict/);
  assert.match(createRoute, /reply\.code\(outcome\.replayed \? 200 : 201\)/);
  assert.match(recurringRoute, /financeEntryRequestFingerprint/);
  assert.match(recurringRoute, /finance_entry_idempotency_conflict/);
  assert.match(recurringRoute, /outcome\.kind === 'replayed' \? 200 : 201/);
});

test('finance request identifiers are stored in dedicated nullable workspace columns with a unique scoped index', async () => {
  const schema = await readFile(new URL('../src/db/schema.ts', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../drizzle/0013_workspace_record_idempotency.sql', import.meta.url), 'utf8');
  const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
  assert.match(schema, /createIdempotencyKey: text\('create_idempotency_key'\)/);
  assert.match(schema, /createRequestHash: text\('create_request_hash'\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS create_idempotency_key text/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS create_request_hash text/);
  assert.match(migration, /UNIQUE INDEX IF NOT EXISTS workspace_records_org_resource_create_key_unique/);
  assert.ok(journal.entries.some((entry) => entry.idx === 13 && entry.tag === '0013_workspace_record_idempotency'));
});
