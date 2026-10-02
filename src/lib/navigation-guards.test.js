import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmSettingsNavigation, dispatchBeforeWorkspaceNavigation, workspaceRouteDestination } from './navigation-guards.js';

test('settings navigation needs no prompt when the form is clean or destination stays in settings', () => {
  let prompts = 0;
  const confirmLeave = () => { prompts += 1; return false; };

  assert.equal(confirmSettingsNavigation({ dirty: false, destinationPage: 'Agenda', confirmLeave }), true);
  assert.equal(confirmSettingsNavigation({ dirty: true, destinationPage: 'Configurações', confirmLeave }), true);
  assert.equal(prompts, 0);
});

test('settings navigation honors the user choice when unsaved changes exist', () => {
  const prompt = (answer) => (message) => {
    assert.match(message, /alterações não salvas/);
    return answer;
  };

  assert.equal(confirmSettingsNavigation({ dirty: true, destinationPage: 'Equipe', confirmLeave: prompt(false) }), false);
  assert.equal(confirmSettingsNavigation({ dirty: true, destinationPage: 'Agenda', confirmLeave: prompt(true) }), true);
});

test('workspace navigation can be canceled by an unsaved form guard', () => {
  const target = new globalThis.EventTarget();
  target.addEventListener('nexo:before-navigate', (event) => {
    assert.equal(event.detail.page, 'Agenda');
    event.preventDefault();
  });

  assert.equal(dispatchBeforeWorkspaceNavigation(target, 'Agenda'), false);
});

test('browser history falls back to Meu Dia for unknown or unauthorized routes', () => {
  assert.equal(workspaceRouteDestination('Financeiro', false), 'Meu Dia');
  assert.equal(workspaceRouteDestination(null, false), 'Meu Dia');
  assert.equal(workspaceRouteDestination('Agenda', true), 'Agenda');
});

test('fallback route still dispatches the unsaved-change guard', () => {
  const target = new globalThis.EventTarget();
  const destination = workspaceRouteDestination('Financeiro', false);
  let guardedPage = null;
  target.addEventListener('nexo:before-navigate', (event) => { guardedPage = event.detail.page; });

  assert.equal(dispatchBeforeWorkspaceNavigation(target, destination), true);
  assert.equal(guardedPage, 'Meu Dia');
});
