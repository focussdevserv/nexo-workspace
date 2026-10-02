import assert from 'node:assert/strict';
import test from 'node:test';
import { recordBelongsToPortalClient } from './client-portal-scope.js';

test('portal preview recognizes every supported client reference field', () => {
  for (const field of ['clientId', 'workspaceClientId', 'clientRecordId']) {
    assert.equal(recordBelongsToPortalClient({ [field]: 'client-a' }, 'client-a'), true, field);
  }
});

test('portal preview rejects missing, malformed, and conflicting client references', () => {
  assert.equal(recordBelongsToPortalClient({}, 'client-a'), false);
  assert.equal(recordBelongsToPortalClient({ clientId: 7 }, '7'), false);
  assert.equal(recordBelongsToPortalClient({ clientId: 'client-b', clientRecordId: 'client-a' }, 'client-a'), false);
});
