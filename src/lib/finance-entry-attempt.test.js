import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { financeEntryAttemptFingerprint, getFinanceEntryAttempt } from './finance-entry-attempt.js';

test('finance create attempts reuse a key for identical data and rotate it when data changes', () => {
  let next = 0;
  const createKey = () => `key-${++next}`;
  const record = { description: 'Internet', amount: 100, code: 'REC-111' };
  const firstFingerprint = financeEntryAttemptFingerprint(record);
  const first = getFinanceEntryAttempt(null, firstFingerprint, createKey);
  const retry = getFinanceEntryAttempt(first, financeEntryAttemptFingerprint({ ...record, code: 'REC-222' }), createKey);
  const changed = getFinanceEntryAttempt(retry, financeEntryAttemptFingerprint({ ...record, amount: 110 }), createKey);
  assert.equal(first.key, retry.key);
  assert.notEqual(first.key, changed.key);
  assert.equal(next, 2);
});

test('recurrence frequency and count are part of a finance create attempt', () => {
  const data = { description: 'Mensalidade', amount: 99 };
  assert.notEqual(financeEntryAttemptFingerprint(data, 'monthly', 12), financeEntryAttemptFingerprint(data, 'monthly', 6));
  assert.notEqual(financeEntryAttemptFingerprint(data, 'monthly', 12), financeEntryAttemptFingerprint(data, 'quarterly', 12));
});

test('finance forms reuse their request key for one-time entries and recurring series', async () => {
  const source = await readFile(new URL('../screens/ServiceScreens.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('function FinanceList(');
  const end = source.indexOf('\nfunction Inbox(', start);
  const screen = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(screen, /financeEntryAttemptRef\.current = getFinanceEntryAttempt/);
  assert.match(screen, /'Idempotency-Key': createAttempt\.key/);
  assert.match(screen, /seriesId: createAttempt\.key/);
  assert.match(screen, /if \(createAttempt\) financeEntryAttemptRef\.current = null/);
  assert.match(screen, /financeSubmitLockRef\.current/);
  assert.doesNotMatch(screen, /seriesId: crypto\.randomUUID\(\)/);
});
