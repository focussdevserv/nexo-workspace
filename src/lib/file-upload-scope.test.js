import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveFileUploadScopeLink } from './file-upload-scope.js';

const scope = { mode: 'selected', clientIds: ['client-1'], projectIds: ['project-1'] };

test('file upload scope requires an assigned client or project for selected scope', () => {
  assert.deepEqual(resolveFileUploadScopeLink(scope, 'client:client-1'), { clientId: 'client-1' });
  assert.deepEqual(resolveFileUploadScopeLink(scope, 'project:project-1', [{ id: 'project-1', clientId: 'client-1' }]), { projectId: 'project-1', clientId: 'client-1' });
  assert.equal(resolveFileUploadScopeLink(scope, ''), null);
  assert.equal(resolveFileUploadScopeLink(scope, 'client:other-client'), null);
  assert.equal(resolveFileUploadScopeLink(scope, 'project:other-project'), null);
});

test('unrestricted file uploads do not need a client or project link', () => {
  assert.deepEqual(resolveFileUploadScopeLink({ mode: 'all', clientIds: [], projectIds: [] }, ''), {});
  assert.deepEqual(resolveFileUploadScopeLink(null, ''), {});
});
