import test from 'node:test';
import assert from 'node:assert/strict';
import { readWorkspaceAccessLocation, stripWorkspaceAccessTokens } from '../screens/workspace-access-helpers.js';

test('browser history location clears stale reset state when returning to login', () => {
  assert.deepEqual(readWorkspaceAccessLocation('', '#access=reset-request'), {
    invite: { token: '', invalid: false },
    resetToken: '',
    accessMode: 'reset-request',
  });
  assert.deepEqual(readWorkspaceAccessLocation('', '#section=home'), {
    invite: { token: '', invalid: false },
    resetToken: '',
    accessMode: 'login',
  });
});

test('browser history location restores reset and invite state from the active URL', () => {
  assert.deepEqual(readWorkspaceAccessLocation('?invite=invite-token', '#reset=reset-token'), {
    invite: { token: 'invite-token', invalid: false },
    resetToken: 'reset-token',
    accessMode: 'reset-complete',
  });
});

test('leaving an invite removes credentials while preserving unrelated query and fragment navigation', () => {
  assert.equal(
    stripWorkspaceAccessTokens('https://focusshub.example/app?invite=secret&tab=team#invite=also-secret&section=members'),
    'https://focusshub.example/app?tab=team#section=members',
  );
});
