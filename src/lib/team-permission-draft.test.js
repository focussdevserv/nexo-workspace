import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmDiscardTeamPermissionDraft, teamPermissionDraftHasChanges } from './team-permission-draft.js';

test('detects permission edits and recognizes restoring the original draft', () => {
  const baseline = { crm: null, scope: { mode: 'all', clientIds: [], projectIds: [] } };
  assert.equal(teamPermissionDraftHasChanges(baseline, baseline), false);
  assert.equal(teamPermissionDraftHasChanges({ ...baseline, crm: { read: true, write: false, delete: false } }, baseline), true);
  assert.equal(teamPermissionDraftHasChanges(structuredClone(baseline), baseline), false);
});

test('does not prompt to discard a clean permission draft', () => {
  let prompts = 0;
  assert.equal(confirmDiscardTeamPermissionDraft({ dirty: false, confirmDiscard: () => { prompts += 1; return false; } }), true);
  assert.equal(prompts, 0);
});

test('keeps dirty permission edits when the user rejects discarding', () => {
  let prompt = '';
  assert.equal(confirmDiscardTeamPermissionDraft({ dirty: true, confirmDiscard: (message) => { prompt = message; return false; } }), false);
  assert.match(prompt, /permissões não salvas/);
});

test('allows discarding dirty permission edits only after explicit confirmation', () => {
  assert.equal(confirmDiscardTeamPermissionDraft({ dirty: true, confirmDiscard: () => true }), true);
});
