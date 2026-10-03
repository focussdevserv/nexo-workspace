import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { clearClientPortalSession, getClientPortalSessionStorage, readClientPortalSession, writeClientPortalSession } from './client-portal-session.js';

const portalScreenSource = readFileSync(fileURLToPath(new URL('../screens/ClientPortalScreens.jsx', import.meta.url)), 'utf8');

function memoryStorage() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
}

test('client portal session survives reload in the same tab and remains isolated by link', () => {
  const storage = memoryStorage();
  writeClientPortalSession(storage, 'link-a', 'session-a', 1000);
  assert.equal(readClientPortalSession(storage, 'link-a', 1001), 'session-a');
  assert.equal(readClientPortalSession(storage, 'link-b', 1001), '');
});

test('client portal session expires after eight hours and is removed from storage', () => {
  const storage = memoryStorage();
  writeClientPortalSession(storage, 'link-a', 'session-a', 1000);
  assert.equal(readClientPortalSession(storage, 'link-a', 1000 + 8 * 60 * 60 * 1000), '');
  assert.equal(storage.getItem('focusshub.client-portal.session.link-a'), null);
});

test('client portal session is cleared on sign out and malformed stored state is discarded', () => {
  const storage = memoryStorage();
  writeClientPortalSession(storage, 'link-a', 'session-a', 1000);
  assert.equal(clearClientPortalSession(storage, 'link-a'), true);
  assert.equal(readClientPortalSession(storage, 'link-a', 1001), '');
  storage.setItem('focusshub.client-portal.session.link-a', '{bad json');
  assert.equal(readClientPortalSession(storage, 'link-a', 1001), '');
  assert.equal(storage.getItem('focusshub.client-portal.session.link-a'), null);
});

test('a server-rejected portal session is cleared before the identity form is shown', () => {
  const verificationRequired = portalScreenSource.match(/if \(response\.status === 401 && payload\.error === 'portal_verification_required'\) \{ if \(active\) \{([^}]+)\}/)?.[1] || '';
  assert.match(verificationRequired, /setRequiresVerification\(true\)/);
  assert.match(verificationRequired, /setAccessToken\(''\)/);
  const storage = memoryStorage();
  writeClientPortalSession(storage, 'link-a', 'rejected-session', 1000);
  clearClientPortalSession(storage, 'link-a');
  assert.equal(readClientPortalSession(storage, 'link-a', 1001), '');
});

test('storage restrictions do not prevent the public portal from loading', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.equal(readClientPortalSession(blocked, 'link-a'), '');
  assert.equal(writeClientPortalSession(blocked, 'link-a', 'session-a'), false);
  assert.equal(clearClientPortalSession(blocked, 'link-a'), false);
});

test('sessionStorage getter failures are caught before session helper calls', () => {
  const blockedWindow = Object.defineProperty({}, 'sessionStorage', { get() { throw new Error('blocked'); } });
  const storage = getClientPortalSessionStorage(blockedWindow);
  assert.equal(storage, null);
  assert.equal(readClientPortalSession(storage, 'link-a'), '');
  assert.equal(writeClientPortalSession(storage, 'link-a', 'session-a'), false);
});
