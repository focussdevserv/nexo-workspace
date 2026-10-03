import assert from 'node:assert/strict';
import test from 'node:test';
import { missingTeamScopeSelections, removeMissingTeamScopeSelections } from './team-scope-selections.js';

test('reports selected clients and projects that disappeared from loaded directories', () => {
  const scope = { clientIds: ['client-a', 'client-deleted'], projectIds: ['project-kept', 'project-deleted'] };
  assert.deepEqual(missingTeamScopeSelections(scope, [{ id: 'client-a' }], [{ id: 'project-kept' }]), {
    clientIds: ['client-deleted'],
    projectIds: ['project-deleted'],
  });
});

test('removes only stale scope IDs and preserves valid IDs and other scope settings', () => {
  const scope = { mode: 'selected', clientIds: ['client-a', 'client-deleted'], projectIds: ['project-kept', 'project-deleted'] };
  assert.deepEqual(removeMissingTeamScopeSelections(scope, {
    clientIds: ['client-deleted'], projectIds: ['project-deleted'],
  }), { mode: 'selected', clientIds: ['client-a'], projectIds: ['project-kept'] });
});

test('treats unavailable source lists as no evidence of missing records', () => {
  const scope = { clientIds: ['client-a'], projectIds: ['project-a'] };
  assert.deepEqual(missingTeamScopeSelections(scope, null, undefined), {
    clientIds: [], projectIds: [],
  });
});
