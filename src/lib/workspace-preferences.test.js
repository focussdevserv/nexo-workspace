import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWorkspacePreferences } from './workspace-preferences.js';

test('workspace preferences default to light mode and preserve dark mode', () => {
  assert.equal(normalizeWorkspacePreferences({}).darkMode, false);
  assert.equal(normalizeWorkspacePreferences({ preferences: { darkMode: true } }).darkMode, true);
});

test('invalid dark mode values fall back to light mode', () => {
  assert.equal(normalizeWorkspacePreferences({ darkMode: 'yes' }).darkMode, false);
});
