import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveClientBillingCancellation } from './client-billing-cancellation.js';

test('client billing cancellation only replaces the matching row with confirmed provider data', () => {
  const rows = [{ id: 'order-1', status: 'pending', description: 'Site' }, { id: 'order-2', status: 'pending' }];
  const confirmed = { id: 'order-1', status: 'cancelled', description: 'Site' };

  assert.deepEqual(resolveClientBillingCancellation({ data: confirmed }, rows, 'order-1'), {
    error: '',
    rows: [confirmed, rows[1]],
  });
});

test('client billing cancellation leaves records untouched when provider still reports an open charge', () => {
  const rows = [{ id: 'order-1', status: 'pending' }];

  assert.deepEqual(resolveClientBillingCancellation({ data: { id: 'order-1', status: 'pending' } }, rows, 'order-1'), {
    error: 'O cancelamento não foi confirmado. Atualize o status da cobrança antes de tentar novamente.',
    rows,
  });
});

test('client billing cancellation rejects a confirmed response for a different order', () => {
  const rows = [{ id: 'order-1', status: 'pending' }];
  const result = resolveClientBillingCancellation({ data: { id: 'order-2', status: 'cancelled' } }, rows, 'order-1');

  assert.match(result.error, /não corresponde a este registro/);
  assert.equal(result.rows, rows);
});
