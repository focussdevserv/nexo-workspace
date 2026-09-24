import assert from 'node:assert/strict';
import test from 'node:test';
import { isSafeWorkspaceData } from '../src/security/workspace-data.ts';

test('accepts ordinary nested workspace records', () => {
  assert.equal(isSafeWorkspaceData({ name: 'Cliente', contacts: [{ email: 'cliente@example.com' }] }), true);
  assert.equal(isSafeWorkspaceData({ name: 'Cliente', portalTokenVersion: 2 }), true);
});

test('rejects credential fields at any object depth', () => {
  assert.equal(isSafeWorkspaceData({ metadata: { provider: { accessToken: 'sensitive' } } }), false);
  assert.equal(isSafeWorkspaceData({ history: [{ apiKey: 'sensitive' }] }), false);
});

test('rejects prototype-sensitive object keys', () => {
  const data = JSON.parse('{"settings":{"__proto__":{"admin":true}}}');
  assert.equal(isSafeWorkspaceData(data), false);
});

test('rejects excessive nesting and oversized payloads', () => {
  let deep: Record<string, unknown> = {};
  const root = deep;
  for (let index = 0; index < 34; index += 1) {
    const next: Record<string, unknown> = {};
    deep.child = next;
    deep = next;
  }
  assert.equal(isSafeWorkspaceData(root), false);
  assert.equal(isSafeWorkspaceData({ text: 'x'.repeat(64_001) }), false);
});

test('rejects non-object records', () => {
  assert.equal(isSafeWorkspaceData([]), false);
  assert.equal(isSafeWorkspaceData(null), false);
});
