import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { recordMatchesWorkspaceScope } from '../src/security/record-scope.js';

const serverSource = readFileSync(new URL('../src/server.ts', import.meta.url), 'utf8');
const selectedScope = { mode: 'selected' as const, clientIds: ['client-in-scope'], projectIds: [] };

test('portal link management respects a member’s selected-client scope', () => {
  assert.equal(recordMatchesWorkspaceScope('clients', 'client-in-scope', {}, selectedScope), true);
  assert.equal(recordMatchesWorkspaceScope('clients', 'client-outside-scope', {}, selectedScope), false);
});

test('portal link creation and revocation check client scope before changing access', () => {
  const revokeStart = serverSource.indexOf("app.delete('/api/workspace/clients/:id/portal-link'");
  const createStart = serverSource.indexOf("app.post('/api/workspace/clients/:id/portal-link'");
  const publicStart = serverSource.indexOf("app.post('/api/public/client-portal/:token/request-code'");
  assert.ok(revokeStart >= 0 && createStart > revokeStart && publicStart > createStart);

  const revokeRoute = serverSource.slice(revokeStart, createStart);
  const createRoute = serverSource.slice(createStart, publicStart);
  const scopeCheck = /recordMatchesWorkspaceScope\('clients', client\.id, client\.data as Record<string, unknown>, request\.user\.permissions\?\.scope\)/;
  assert.match(revokeRoute, scopeCheck);
  assert.match(createRoute, scopeCheck);
  assert.ok(revokeRoute.indexOf('recordMatchesWorkspaceScope') < revokeRoute.indexOf('portalTokenVersion'));
  assert.ok(createRoute.indexOf('recordMatchesWorkspaceScope') < createRoute.indexOf('portalTokenVersion'));
});
