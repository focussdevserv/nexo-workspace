import assert from 'node:assert/strict';
import test from 'node:test';
import { canWriteApprovalRecords } from './approval-permissions.js';

test('approval writes follow the support module permission, including explicit denial', () => {
  assert.equal(canWriteApprovalRecords('member', undefined), true);
  assert.equal(canWriteApprovalRecords('member', { support: { read: true, write: false } }), false);
  assert.equal(canWriteApprovalRecords('member', { support: { read: true, write: true } }), true);
});

test('approval writes fail closed for unknown roles while admin roles retain access', () => {
  assert.equal(canWriteApprovalRecords('unknown', {}), false);
  assert.equal(canWriteApprovalRecords('admin', { support: { write: false } }), true);
  assert.equal(canWriteApprovalRecords('owner', {}), true);
});
