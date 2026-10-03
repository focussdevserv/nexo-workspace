import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PERSISTENT_SESSION_RENEWAL_THRESHOLD_SECONDS, PERSISTENT_WORKSPACE_SESSION_SECONDS, WORKSPACE_SESSION_SECONDS, shouldRenewPersistentWorkspaceSession, workspaceSessionCookieOptions, workspaceSessionPolicy, workspaceSessionVersionIsCurrent } from '../src/auth/session-policy.js';

test('workspace login defaults to a persistent 30-day session and permits an 8-hour session', () => {
  assert.deepEqual(workspaceSessionPolicy(), { maxAge: 30 * 24 * 60 * 60, expiresIn: '2592000s' });
  assert.equal(workspaceSessionPolicy().maxAge, PERSISTENT_WORKSPACE_SESSION_SECONDS);
  assert.equal(workspaceSessionPolicy(false).maxAge, WORKSPACE_SESSION_SECONDS);
  assert.equal(workspaceSessionPolicy(false).expiresIn, '28800s');
});

test('session cookies remain HttpOnly and strict same-site for both HTTP and HTTPS', () => {
  assert.deepEqual(workspaceSessionCookieOptions(60, true), { path: '/', httpOnly: true, secure: true, sameSite: 'strict', maxAge: 60 });
  assert.deepEqual(workspaceSessionCookieOptions(60, false), { path: '/', httpOnly: true, secure: false, sameSite: 'strict', maxAge: 60 });
});

test('remembered sessions renew as they approach expiry, while short sessions never renew', () => {
  const now = 2_000_000;
  assert.equal(shouldRenewPersistentWorkspaceSession(true, now + PERSISTENT_SESSION_RENEWAL_THRESHOLD_SECONDS, now), true);
  assert.equal(shouldRenewPersistentWorkspaceSession(true, now + PERSISTENT_SESSION_RENEWAL_THRESHOLD_SECONDS + 1, now), false);
  assert.equal(shouldRenewPersistentWorkspaceSession(false, now + 1, now), false);
  assert.equal(shouldRenewPersistentWorkspaceSession(true, 'invalid', now), false);
});

test('revoked sessions stay invalid after a suspended account is reactivated', async () => {
  assert.equal(workspaceSessionVersionIsCurrent(undefined, 0), true, 'legacy sessions remain valid before any revocation');
  assert.equal(workspaceSessionVersionIsCurrent(4, 4), true);
  assert.equal(workspaceSessionVersionIsCurrent(4, 5), false, 'old cookie version is rejected after revocation');
  assert.equal(workspaceSessionVersionIsCurrent(undefined, 1), false, 'legacy cookie cannot return after revocation');

  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const inviteHandler = source.slice(source.indexOf("app.post('/api/team/invites'"), source.indexOf("app.post('/api/team/users/:id/deactivate'"));
  const deactivateHandler = source.slice(source.indexOf("app.post('/api/team/users/:id/deactivate'"), source.indexOf("app.post('/api/auth/accept-invite'"));
  const acceptInviteHandler = source.slice(source.indexOf("app.post('/api/auth/accept-invite'"), source.indexOf("app.post('/api/auth/login'"));
  assert.match(inviteHandler, /sessionVersion:\s*sql`\$\{users\.sessionVersion\}\s*\+\s*1`/);
  assert.match(deactivateHandler, /sessionVersion:\s*sql`\$\{users\.sessionVersion\}\s*\+\s*1`/);
  assert.match(acceptInviteHandler, /permissions:\s*users\.permissions,\s*sessionVersion:\s*users\.sessionVersion/);
  assert.match(acceptInviteHandler, /sessionVersion:\s*activated\.sessionVersion/);
});

test('owner can revoke an unaccepted invitation without issuing a replacement link', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const deactivateHandler = source.slice(source.indexOf("app.post('/api/team/users/:id/deactivate'"), source.indexOf("app.post('/api/auth/accept-invite'"));
  assert.match(deactivateHandler, /if \(request\.user\.role !== 'owner'\)/);
  assert.match(deactivateHandler, /inviteVersion:\s*sql`\$\{users\.inviteVersion\}\s*\+\s*1`/);
  assert.match(deactivateHandler, /sessionVersion:\s*sql`\$\{users\.sessionVersion\}\s*\+\s*1`/);
  assert.doesNotMatch(deactivateHandler, /eq\(users\.active,\s*true\)/, 'inactive pending accounts must also be revocable');
});
