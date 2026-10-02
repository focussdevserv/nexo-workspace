import assert from 'node:assert/strict';
import test from 'node:test';
import { recordBelongsToPortalClient } from '../src/security/client-portal-record-scope.js';

test('portal record scope accepts each supported client reference field', () => {
  for (const field of ['clientId', 'workspaceClientId', 'clientRecordId']) {
    assert.equal(recordBelongsToPortalClient({ [field]: 'client-a' }, 'client-a'), true, field);
  }
});

test('portal record scope rejects unrelated or malformed client references', () => {
  assert.equal(recordBelongsToPortalClient({ clientId: 'client-b' }, 'client-a'), false);
  assert.equal(recordBelongsToPortalClient({ workspaceClientId: 'client-b', clientRecordId: 'client-a' }, 'client-a'), false);
  assert.equal(recordBelongsToPortalClient({ clientId: 42 }, '42'), false);
  assert.equal(recordBelongsToPortalClient({}, 'client-a'), false);
});
