import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { isSupportedBillingAmount } from '../src/billing/amount.ts';

test('billing amount validation accepts BRL cent values within the provider limit', () => {
  assert.equal(isSupportedBillingAmount(0.01), true);
  assert.equal(isSupportedBillingAmount(1000000), true);
});

test('billing amount validation rejects values that would be rounded by the provider', () => {
  assert.equal(isSupportedBillingAmount(10.001), false);
  assert.equal(isSupportedBillingAmount(10.005), false);
  assert.equal(isSupportedBillingAmount(0), false);
  assert.equal(isSupportedBillingAmount(-1), false);
  assert.equal(isSupportedBillingAmount(1000000.01), false);
});

test('both order and recurring subscription request schemas enforce currency precision', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  assert.equal((source.match(/amount: z\.coerce\.number\(\)\.refine\(isSupportedBillingAmount/g) || []).length, 2);
});
