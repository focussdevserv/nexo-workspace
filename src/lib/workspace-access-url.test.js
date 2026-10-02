import assert from 'node:assert/strict';
import test from 'node:test';
import { stripWorkspaceAccessTokens } from '../screens/workspace-access-helpers.js';

test('removes one-time recovery tokens from the address while preserving unrelated URL state', () => {
  assert.equal(
    stripWorkspaceAccessTokens('https://focusshub.example/app?tab=login#reset=one-time-token&campaign=spring'),
    'https://focusshub.example/app?tab=login#campaign=spring',
  );
});

test('removes invite tokens from query and fragment without changing ordinary navigation', () => {
  assert.equal(
    stripWorkspaceAccessTokens('https://focusshub.example/app?invite=secret&tab=team#invite=also-secret&view=members'),
    'https://focusshub.example/app?tab=team#view=members',
  );
  assert.equal(
    stripWorkspaceAccessTokens('https://focusshub.example/app?tab=team#section=members'),
    'https://focusshub.example/app?tab=team#section=members',
  );
});
