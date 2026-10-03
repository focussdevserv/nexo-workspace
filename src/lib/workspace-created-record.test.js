import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCreatedWorkspaceRecord } from './workspace-created-record.js';

test('resolves a newly created record after the API replaces its temporary ID', () => {
  const persisted = { id: 'server-uuid', title: 'Kickoff', date: '2026-10-05' };
  const result = { records: [persisted], createdIds: { 'local-temp-id': 'server-uuid' } };
  assert.equal(resolveCreatedWorkspaceRecord(result, 'local-temp-id'), persisted);
});

test('supports a save result that retained the temporary ID and handles missing records', () => {
  const retained = { id: 'local-temp-id', title: 'Kickoff' };
  assert.equal(resolveCreatedWorkspaceRecord({ records: [retained] }, 'local-temp-id'), retained);
  assert.equal(resolveCreatedWorkspaceRecord({ records: [] }, 'local-temp-id'), null);
});
