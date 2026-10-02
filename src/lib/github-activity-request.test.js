import assert from 'node:assert/strict';
import test from 'node:test';
import { startGithubActivityRequest } from './github-activity-request.js';

test('invalid or disconnected GitHub searches do not supersede a running request', () => {
  let starts = 0;
  const guard = { begin: () => ++starts };
  assert.deepEqual(startGithubActivityRequest(guard, 'invalid owner!', 'repo', { configured: true, enabled: true }), {
    requestId: null, error: 'Informe proprietário e repositório com nomes válidos do GitHub.',
  });
  assert.deepEqual(startGithubActivityRequest(guard, 'owner', 'repo', { configured: true, enabled: false }), {
    requestId: null, error: 'Reative o GitHub no Focusshub antes de consultar.',
  });
  assert.equal(starts, 0);
});

test('a valid connected GitHub search starts a guarded request', () => {
  const guard = { begin: () => 'request-1' };
  assert.deepEqual(startGithubActivityRequest(guard, 'Focusshub', 'web-app', { configured: true, enabled: true }), {
    requestId: 'request-1', error: '',
  });
});
