import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSettingsHydration } from './settings-hydration.js';
import { resolveSettingsDraftUpdate } from './settings-draft.js';
import { workspacePreferencesFromSettings } from './workspace-preferences.js';

const defaults = {
  workspace: { agency: '', timezone: 'America/Sao_Paulo', weekStart: 'monday' },
  preferences: { compact: false, darkMode: false, startPage: 'Meu Dia' },
};

test('settings updates accept functional drafts used by agency logo actions', () => {
  const current = { workspace: { agency: 'Focusshub', brandLogo: 'old-logo' }, preferences: { darkMode: true } };
  const next = resolveSettingsDraftUpdate(current, (draft) => ({
    ...draft,
    workspace: { ...draft.workspace, brandLogo: 'new-logo' },
  }));

  assert.deepEqual(next, { workspace: { agency: 'Focusshub', brandLogo: 'new-logo' }, preferences: { darkMode: true } });
  assert.equal(current.workspace.brandLogo, 'old-logo', 'the previous settings object remains unchanged');
  assert.deepEqual(resolveSettingsDraftUpdate(current, { workspace: { agency: 'Imported' } }), { workspace: { agency: 'Imported' } });
});

test('successful settings fetch hydrates saved values that the app consumes', () => {
  const resolved = resolveSettingsHydration({
    defaults,
    savedRecord: { savedAt: '2026-10-02T12:00:00.000Z', settings: { preferences: { compact: true, darkMode: true, startPage: 'Agenda' } } },
    loading: false,
    error: null,
    dirty: false,
  });

  assert.equal(resolved.settings.preferences.compact, true);
  assert.equal(resolved.settings.preferences.darkMode, true);
  assert.equal(resolved.savedAt, '2026-10-02T12:00:00.000Z');
  const appPreferences = workspacePreferencesFromSettings(resolved.settings);
  assert.equal(appPreferences.compact, true);
  assert.equal(appPreferences.darkMode, true);
  assert.equal(appPreferences.startPage, 'Agenda');
  assert.equal(appPreferences.timezone, 'America/Sao_Paulo');
  assert.equal(appPreferences.weekStart, 'monday');
});

test('does not hydrate over a dirty local draft', () => {
  assert.equal(resolveSettingsHydration({
    defaults,
    savedRecord: { settings: { preferences: { compact: false } } },
    loading: false,
    error: null,
    dirty: true,
  }), null);
});

test('waits for a successful fetch before hydrating', () => {
  for (const state of [{ loading: true, error: null }, { loading: false, error: new Error('offline') }]) {
    assert.equal(resolveSettingsHydration({ defaults, savedRecord: null, dirty: false, ...state }), null);
  }
});
