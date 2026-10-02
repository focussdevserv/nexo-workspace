import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmSettingsImport, normalizeImportedSettings } from './settings-import.js';

const defaults = {
  workspace: { timezone: 'America/Sao_Paulo', weekStart: 'monday', agency: '' },
  preferences: { startPage: 'Meu Dia', darkMode: false },
  billing: { defaultDueDays: '7' },
};

test('settings import replaces dirty edits only after explicit confirmation', () => {
  let prompted = 0;
  const confirmReplace = (message) => { prompted += 1; assert.match(message, /substituÃ­-las/); return false; };

  assert.equal(confirmSettingsImport({ dirty: false, confirmReplace }), true);
  assert.equal(confirmSettingsImport({ dirty: true, confirmReplace }), false);
  assert.equal(prompted, 1);
});

test('normalizes imported select values to supported workspace choices', () => {
  const imported = normalizeImportedSettings({ version: 1, settings: {
    workspace: { timezone: 'Mars/Olympus', weekStart: 'friday', agency: 'Focus' },
    preferences: { startPage: 'Unknown screen', darkMode: true },
  } }, defaults);

  assert.equal(imported.workspace.timezone, defaults.workspace.timezone);
  assert.equal(imported.workspace.weekStart, defaults.workspace.weekStart);
  assert.equal(imported.preferences.startPage, defaults.preferences.startPage);
  assert.equal(imported.workspace.agency, 'Focus');
  assert.equal(imported.preferences.darkMode, true);
});

test('rejects invalid settings export envelopes', () => {
  assert.throws(() => normalizeImportedSettings({ version: 2, settings: {} }, defaults));
  assert.throws(() => normalizeImportedSettings({ version: 1, settings: [] }, defaults));
});

test('normalizes imported billing due dates to options shown in the settings select', () => {
  const invalid = normalizeImportedSettings({ version: 1, settings: { billing: { defaultDueDays: '999' } } }, defaults);
  const valid = normalizeImportedSettings({ version: 1, settings: { billing: { defaultDueDays: '15' } } }, defaults);

  assert.equal(invalid.billing.defaultDueDays, defaults.billing.defaultDueDays);
  assert.equal(valid.billing.defaultDueDays, '15');
});

test('preserves an imported start page from any workspace module', () => {
  const imported = normalizeImportedSettings({ version: 1, settings: { preferences: { startPage: 'Cobranças' } } }, defaults);
  assert.equal(imported.preferences.startPage, 'Cobranças');
});
