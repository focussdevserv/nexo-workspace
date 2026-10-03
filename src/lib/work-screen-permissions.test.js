import assert from 'node:assert/strict';
import test from 'node:test';
import { canDeleteTaskRecords, canWriteDeliveryRecords } from './work-screen-permissions.js';

test('delivery controls follow member overrides while keeping the API baseline', () => {
  assert.equal(canWriteDeliveryRecords('member'), true);
  assert.equal(canWriteDeliveryRecords('member', {}), true);
  assert.equal(canWriteDeliveryRecords('member', { delivery: { read: true, write: false } }), false);
  assert.equal(canWriteDeliveryRecords('member', { delivery: { read: true } }), false);
  assert.equal(canWriteDeliveryRecords('member', { delivery: { read: true, write: true } }), true);
  assert.equal(canWriteDeliveryRecords('owner', { delivery: { write: false } }), true);
  assert.equal(canWriteDeliveryRecords('admin', { delivery: { write: false } }), true);
  assert.equal(canWriteDeliveryRecords('unknown', {}), false);
});

test('task deletion follows the API delete override independently of write access', () => {
  assert.equal(canDeleteTaskRecords('member'), true);
  assert.equal(canDeleteTaskRecords('member', { delivery: { read: true, write: true } }), false);
  assert.equal(canDeleteTaskRecords('member', { delivery: { read: true, delete: true } }), true);
  assert.equal(canDeleteTaskRecords('owner', { delivery: { delete: false } }), true);
});
