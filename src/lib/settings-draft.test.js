import assert from 'node:assert/strict';
import test from 'node:test';
import { settingsBaseline, settingsDraftHasChanges } from './settings-draft.js';

const defaults = {
  workspace: { agency: '', timezone: 'America/Sao_Paulo' },
  preferences: { darkMode: false },
};

test('settings baseline overlays persisted values while keeping defaults for missing fields', () => {
  assert.deepEqual(settingsBaseline(defaults, { workspace: { agency: 'Focusshub' } }), {
    workspace: { agency: 'Focusshub', timezone: 'America/Sao_Paulo' },
    preferences: { darkMode: false },
  });
});

test('settings draft comparison detects edits and clears when the original value is restored', () => {
  const baseline = settingsBaseline(defaults, { workspace: { agency: 'Focusshub' } });
  assert.equal(settingsDraftHasChanges({ ...baseline, workspace: { ...baseline.workspace, timezone: 'UTC' } }, baseline), true);
  assert.equal(settingsDraftHasChanges(structuredClone(baseline), baseline), false);
});
