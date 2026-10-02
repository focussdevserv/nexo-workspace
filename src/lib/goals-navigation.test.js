import assert from 'node:assert/strict';
import test from 'node:test';
import { guardGoalsNavigation, shouldConfirmGoalsNavigation } from './goals-navigation.js';

test('pending goal edits prompt before leaving the goals screen', () => {
  assert.equal(shouldConfirmGoalsNavigation(true, 'Relatórios'), true);
  assert.equal(shouldConfirmGoalsNavigation(true, 'Meu Dia'), true);
});

test('clean goals and same-screen navigation do not prompt', () => {
  assert.equal(shouldConfirmGoalsNavigation(false, 'Relatórios'), false);
  assert.equal(shouldConfirmGoalsNavigation(true, 'Metas'), false);
  assert.equal(shouldConfirmGoalsNavigation(true, undefined), false);
});

test('navigation is canceled when the user keeps unsaved goal edits', () => {
  let canceled = false;
  let prompt = '';
  const allowed = guardGoalsNavigation({ detail: { page: 'Financeiro' }, preventDefault: () => { canceled = true; } }, {
    dirty: true,
    confirmLeave: (message) => { prompt = message; return false; },
  });
  assert.equal(allowed, false);
  assert.equal(canceled, true);
  assert.match(prompt, /alterações não salvas/);
});

test('accepted navigation continues and clean state does not open a prompt', () => {
  let prompts = 0;
  const event = { detail: { page: 'Financeiro' }, preventDefault() { throw new Error('should not cancel'); } };
  assert.equal(guardGoalsNavigation(event, { dirty: true, confirmLeave: () => { prompts += 1; return true; } }), true);
  assert.equal(guardGoalsNavigation(event, { dirty: false, confirmLeave: () => { prompts += 1; return false; } }), true);
  assert.equal(prompts, 1);
});
