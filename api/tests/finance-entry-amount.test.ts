import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { isValidFinanceEntryAmount } from '../src/integrations/finance-entry-amount.ts';

test('manual finance entries accept positive values exactly representable in cents', () => {
  assert.equal(isValidFinanceEntryAmount(0.01), true);
  assert.equal(isValidFinanceEntryAmount(2500.5), true);
});

test('manual finance entries reject missing, non-numeric, negative, zero and fractional-cent values', () => {
  for (const amount of [undefined, null, '12.50', 0, -0.01, 10.001, 10.005, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(isValidFinanceEntryAmount(amount), false, `expected ${String(amount)} to be rejected`);
  }
});

test('revenue and expense endpoints validate amounts on create and when an edit changes the amount', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const create = source.slice(source.indexOf("app.post('/api/workspace/:resource'"), source.indexOf("app.patch('/api/workspace/:resource/:id'"));
  const update = source.slice(source.indexOf("app.patch('/api/workspace/:resource/:id'"), source.indexOf("app.delete('/api/workspace/:resource/:id'"));
  assert.match(create, /financeEntryCreate[\s\S]{0,500}isValidFinanceEntryAmount/);
  assert.match(update, /financeEntryUpdate[\s\S]{0,500}isValidFinanceEntryAmount/);
});
