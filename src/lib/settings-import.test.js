import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmSettingsImport, normalizeImportedSettings } from './settings-import.js';

const defaults = {
  workspace: { timezone: 'America/Sao_Paulo', weekStart: 'monday', agency: '', language: 'pt-BR', currency: 'BRL', dateFormat: 'dd/MM/yyyy' },
  preferences: { startPage: 'Meu Dia', darkMode: false },
  billing: { defaultDueDays: '7' },
};

test('settings import replaces dirty edits only after explicit confirmation', () => {
  let prompted = 0;
  const confirmReplace = (message) => { prompted += 1; assert.match(message, /substituí-las/); return false; };

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
  assert.throws(() => normalizeImportedSettings({ version: 2, settings: {} }, defaults), /exportação válida das configurações/);
  assert.throws(() => normalizeImportedSettings({ version: 1, settings: [] }, defaults), /exportação válida das configurações/);
});

test('normalizes imported billing due dates to options shown in the settings select', () => {
  const invalid = normalizeImportedSettings({ version: 1, settings: { billing: { defaultDueDays: '999' } } }, defaults);
  const valid = normalizeImportedSettings({ version: 1, settings: { billing: { defaultDueDays: '15' } } }, defaults);

  assert.equal(invalid.billing.defaultDueDays, defaults.billing.defaultDueDays);
  assert.equal(valid.billing.defaultDueDays, '15');
});

test('imports supported locale, currency, and date formats while replacing unsupported values with defaults', () => {
  const settings = normalizeImportedSettings({ version: 1, settings: { workspace: { language: 'en-US', currency: 'USD', dateFormat: 'yyyy-MM-dd' } } }, defaults);
  assert.equal(settings.workspace.language, 'en-US');
  assert.equal(settings.workspace.currency, 'USD');
  assert.equal(settings.workspace.dateFormat, 'yyyy-MM-dd');
  const unsafe = normalizeImportedSettings({ version: 1, settings: { workspace: { language: 'xx', currency: 'BTC', dateFormat: 'DD-MM-YYYY' } } }, defaults);
  assert.equal(unsafe.workspace.language, defaults.workspace.language);
  assert.equal(unsafe.workspace.currency, defaults.workspace.currency);
  assert.equal(unsafe.workspace.dateFormat, defaults.workspace.dateFormat);
});

test('preserves an imported start page from any workspace module', () => {
  const imported = normalizeImportedSettings({ version: 1, settings: { preferences: { startPage: 'Cobranças' } } }, defaults);
  assert.equal(imported.preferences.startPage, 'Cobranças');
});
