import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWorkspacePreferences, workspacePreferencesFromSettings, workspaceStartPages } from './workspace-preferences.js';

test('workspace preferences default to light mode and preserve dark mode', () => {
  assert.equal(normalizeWorkspacePreferences({}).darkMode, false);
  assert.equal(normalizeWorkspacePreferences({ preferences: { darkMode: true } }).darkMode, true);
});

test('invalid dark mode values fall back to light mode', () => {
  assert.equal(normalizeWorkspacePreferences({ darkMode: 'yes' }).darkMode, false);
});

test('every workspace module can be saved as the start page and survives preference normalization', () => {
  for (const startPage of workspaceStartPages) {
    assert.equal(normalizeWorkspacePreferences({ startPage }).startPage, startPage);
  }
  assert.ok(workspaceStartPages.includes('Caixa de entrada'));
  assert.ok(workspaceStartPages.includes('Cobranças'));
  assert.ok(workspaceStartPages.includes('Configurações'));
});

test('settings reset publishes the reset timezone and week start rather than stale values', () => {
  const reset = workspacePreferencesFromSettings({
    workspace: { timezone: 'America/Sao_Paulo', weekStart: 'monday' },
    preferences: { darkMode: false, compact: false },
  });
  assert.equal(normalizeWorkspacePreferences(reset).timezone, 'America/Sao_Paulo');
  assert.equal(normalizeWorkspacePreferences(reset).weekStart, 'monday');
});
