import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { isValidFinanceEntryDate, isValidOptionalFinanceEntryDate } from '../src/integrations/finance-entry-date.ts';

test('manual finance dates accept real calendar days and reject rollover dates', () => {
  assert.equal(isValidFinanceEntryDate('2024-02-29'), true);
  assert.equal(isValidFinanceEntryDate('2026-02-29'), false);
  assert.equal(isValidFinanceEntryDate('2026-13-01'), false);
  assert.equal(isValidFinanceEntryDate('2026-1-01'), false);
  assert.equal(isValidFinanceEntryDate('2026-10-03T00:00:00Z'), false);
});

test('manual finance due dates may be omitted or cleared, otherwise must be valid calendar days', () => {
  assert.equal(isValidOptionalFinanceEntryDate(null), true);
  assert.equal(isValidOptionalFinanceEntryDate(''), true);
  assert.equal(isValidOptionalFinanceEntryDate('2026-10-03'), true);
  assert.equal(isValidOptionalFinanceEntryDate('2026-02-30'), false);
});

test('revenue and expense endpoints validate entry and optional due dates on create and update', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const create = source.slice(source.indexOf("app.post('/api/workspace/:resource'"), source.indexOf("app.patch('/api/workspace/:resource/:id'"));
  const update = source.slice(source.indexOf("app.patch('/api/workspace/:resource/:id'"), source.indexOf("app.delete('/api/workspace/:resource/:id'"));
  assert.match(create, /financeEntryCreate[\s\S]{0,800}isValidFinanceEntryDate[\s\S]{0,200}isValidOptionalFinanceEntryDate/);
  assert.match(update, /financeEntryUpdate[\s\S]{0,800}isValidFinanceEntryDate[\s\S]{0,200}isValidOptionalFinanceEntryDate/);
});
