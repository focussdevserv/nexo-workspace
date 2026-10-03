import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { authenticatedWorkspaceUserWithCurrentPermissions } from '../src/security/authenticated-workspace-user.ts';

test('authenticated request context uses current database scope instead of JWT claim scope', () => {
  const claims = { sub: 'user-1', organizationId: 'org-1', role: 'member' as const, permissions: { scope: { mode: 'all' as const, clientIds: [], projectIds: [] } } };
  const databasePermissions = { crm: { read: true }, scope: { mode: 'selected' as const, clientIds: ['client-1'], projectIds: ['project-1'] } };

  const authenticated = authenticatedWorkspaceUserWithCurrentPermissions(claims, databasePermissions);
  assert.deepEqual(authenticated.permissions, databasePermissions);
  assert.equal(authenticated.permissions?.scope?.mode, 'selected');
  assert.equal(claims.permissions.scope.mode, 'all');
});

test('authenticate hydrates request.user before later handlers apply record-level scopes', async () => {
  const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const authenticate = server.match(/app\.decorate\('authenticate',[\s\S]*?\n\}\);/)?.[0] || '';
  assert.match(authenticate, /authenticatedWorkspaceUserWithCurrentPermissions\(request\.user, user\.permissions\)/);
});
