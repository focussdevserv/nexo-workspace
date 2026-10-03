import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldCloseTeamDialog } from './team-dialog.js';

test('team person dialog closes with Escape when idle', () => {
  assert.equal(shouldCloseTeamDialog('Escape', false), true);
});

test('team person dialog stays open during save and for other keys', () => {
  assert.equal(shouldCloseTeamDialog('Escape', true), false);
  assert.equal(shouldCloseTeamDialog('Enter', false), false);
});
