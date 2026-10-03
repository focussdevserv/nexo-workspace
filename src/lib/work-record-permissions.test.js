import assert from 'node:assert/strict';
import test from 'node:test';
import { canDeleteWorkRecords, canWriteWorkRecords } from './work-record-permissions.js';

test('Horas follows the API delivery write/delete permissions for members', () => {
  assert.equal(canWriteWorkRecords('member', undefined, 'delivery'), false);
  assert.equal(canDeleteWorkRecords('member', undefined, 'delivery'), false);
  assert.equal(canWriteWorkRecords('member', { delivery: { read: true, write: true, delete: false } }, 'delivery'), true);
  assert.equal(canDeleteWorkRecords('member', { delivery: { read: true, write: true, delete: true } }, 'delivery'), true);
  assert.equal(canDeleteWorkRecords('member', { delivery: { read: true, write: true, delete: null } }, 'delivery'), false);
});

test('Arquivos uses support permissions and its inherited write but restricted delete baseline', () => {
  assert.equal(canWriteWorkRecords('member', undefined, 'support'), true);
  assert.equal(canDeleteWorkRecords('member', undefined, 'support'), false);
  assert.equal(canWriteWorkRecords('member', { support: { read: true, write: false } }, 'support'), false);
  assert.equal(canDeleteWorkRecords('member', { support: { read: true, write: true, delete: true } }, 'support'), true);
});

test('owners and admins retain permissions while unknown roles fail closed', () => {
  for (const role of ['owner', 'admin']) {
    assert.equal(canWriteWorkRecords(role, {}, 'delivery'), true);
    assert.equal(canDeleteWorkRecords(role, {}, 'support'), true);
  }
  assert.equal(canWriteWorkRecords('unknown', {}, 'support'), false);
  assert.equal(canDeleteWorkRecords('unknown', {}, 'support'), false);
});
