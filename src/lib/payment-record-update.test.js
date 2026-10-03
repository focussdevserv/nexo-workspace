import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { replacePaymentRecord } from './payment-record-update.js';

test('confirmed payment updates replace the matching row by ID and preserve other rows', () => {
  const other = { id: 'other', status: 'pending' };
  const updated = { id: '42', status: 'canceled' };
  assert.deepEqual(replacePaymentRecord([other, { id: 42, status: 'pending' }], updated), [other, updated]);
});

test('ignores malformed update responses without changing the payment list', () => {
  const rows = [{ id: 'order-1', status: 'pending' }];
  assert.equal(replacePaymentRecord(rows, null), rows);
  assert.equal(replacePaymentRecord(rows, { status: 'canceled' }), rows);
});

test('payment console applies the confirmed cancel response before attempting a list refresh', async () => {
  const source = await readFile(new URL('../screens/PaymentScreens.jsx', import.meta.url), 'utf8');
  const cancel = source.slice(source.indexOf('const cancelOrder = async'), source.indexOf('const refreshOrder = async'));
  assert.match(cancel, /const response = await request\([^;]+;\s*const cancellationError = paymentCancellationError\(response\);\s*if \(cancellationError\) throw new Error\(cancellationError\);\s*if \(response\.data\) setItems\(\(current\) => replacePaymentRecord\(current, response\.data\)\);\s*await refresh\(\);/);
});
