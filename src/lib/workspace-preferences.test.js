import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmWorkspaceDelete, normalizeWorkspacePreferences, workspaceColorScheme, workspacePreferencesFromSettings, workspaceStartPages } from './workspace-preferences.js';

test('workspace preferences default to light mode and preserve dark mode', () => {
  assert.equal(normalizeWorkspacePreferences({}).darkMode, false);
  assert.equal(normalizeWorkspacePreferences({ preferences: { darkMode: true } }).darkMode, true);
});

test('invalid dark mode values fall back to light mode', () => {
  assert.equal(normalizeWorkspacePreferences({ darkMode: 'yes' }).darkMode, false);
});

test('the selected theme controls native form and forced-color behavior consistently', () => {
  assert.equal(workspaceColorScheme(false), 'only light');
  assert.equal(workspaceColorScheme(true), 'dark');
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

test('workspace locale, currency, and date format flow from saved settings into shared preferences', () => {
  const settings = workspacePreferencesFromSettings({ workspace: { language: 'en-US', currency: 'USD', dateFormat: 'MM/dd/yyyy' } });
  assert.deepEqual(normalizeWorkspacePreferences(settings), {
    compact: false, darkMode: false, showCompleted: false, confirmDelete: true, startPage: 'Meu Dia',
    timezone: 'America/Sao_Paulo', weekStart: 'monday', language: 'en-US', currency: 'USD', dateFormat: 'MM/dd/yyyy',
  });
});

test('invalid locale, currency, and date format values safely use Portuguese Brazilian defaults', () => {
  const prefs = normalizeWorkspacePreferences({ language: 'xx-INVALID', currency: 'DOGE', dateFormat: 'yyyy-dd-MM' });
  assert.equal(prefs.language, 'pt-BR');
  assert.equal(prefs.currency, 'BRL');
  assert.equal(prefs.dateFormat, 'dd/MM/yyyy');
});

test('delete preference skips routine confirmation only when explicitly disabled', () => {
  let asked = 0;
  const confirmAction = () => { asked += 1; return false; };
  assert.equal(confirmWorkspaceDelete('Delete?', { confirmDelete: false }, confirmAction), true);
  assert.equal(asked, 0);
  assert.equal(confirmWorkspaceDelete('Delete?', { confirmDelete: true }, confirmAction), false);
  assert.equal(confirmWorkspaceDelete('Delete?', {}, confirmAction), false);
  assert.equal(asked, 2);
});
