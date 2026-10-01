import assert from 'node:assert/strict';
import test from 'node:test';
import { billingClientIdsForWorkspaceScope, recordMatchesWorkspaceScope } from '../src/security/record-scope.ts';

const scope = { mode: 'selected' as const, clientIds: ['client-a'], projectIds: ['project-b'] };

test('selected client and project scopes include only linked records', () => {
  assert.equal(recordMatchesWorkspaceScope('clients', 'client-a', {}, scope), true);
  assert.equal(recordMatchesWorkspaceScope('clients', 'client-x', {}, scope), false);
  assert.equal(recordMatchesWorkspaceScope('projects', 'project-b', {}, scope), true);
  assert.equal(recordMatchesWorkspaceScope('projects', 'project-x', { clientId: 'client-a' }, scope), true);
  assert.equal(recordMatchesWorkspaceScope('tasks', 'task-a', { projectId: 'project-b' }, scope), true);
  assert.equal(recordMatchesWorkspaceScope('tickets', 'ticket-a', { workspaceClientId: 'client-a' }, scope), true);
  assert.equal(recordMatchesWorkspaceScope('tickets', 'ticket-x', { client: 'Same visible name' }, scope), false);
});

test('unrelated workspace configuration stays shared while all scope preserves legacy access', () => {
  assert.equal(recordMatchesWorkspaceScope('services', 'service-x', {}, scope), true);
  assert.equal(recordMatchesWorkspaceScope('finance-accounts', 'account-x', {}, scope), true);
  assert.equal(recordMatchesWorkspaceScope('leads', 'lead-x', {}, { ...scope, mode: 'all' }), true);
});

test('billing scope includes assigned clients and clients attached to assigned projects only', () => {
  assert.deepEqual(billingClientIdsForWorkspaceScope(scope, [
    { id: 'project-b', data: { clientId: 'client-from-project' } },
    { id: 'project-x', data: { clientId: 'unassigned-client' } },
  ]), ['client-a', 'client-from-project']);
  assert.deepEqual(billingClientIdsForWorkspaceScope({ ...scope, clientIds: [], projectIds: [] }, []), []);
  assert.equal(billingClientIdsForWorkspaceScope({ ...scope, mode: 'all' }, []), null);
});
