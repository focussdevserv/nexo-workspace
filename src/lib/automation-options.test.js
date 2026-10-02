import assert from 'node:assert/strict';
import test from 'node:test';
import { automationActionOptions, automationActionsForTrigger, defaultAutomationAction } from './automation-options.js';

const templates = [
  { trigger: 'Novo lead', action: 'Criar follow-up' },
  { trigger: 'Novo lead', action: 'Criar follow-up' },
  { trigger: 'Cobrança vencida', action: 'Criar tarefa de revisão' },
  { trigger: 'Cobrança vencida', action: 'Notificar financeiro' },
];

test('lists only actions that belong to the selected trigger and removes duplicates', () => {
  assert.deepEqual(automationActionsForTrigger('Novo lead', templates), ['Criar follow-up']);
  assert.deepEqual(automationActionsForTrigger('Cobrança vencida', templates), ['Criar tarefa de revisão', 'Notificar financeiro']);
});

test('chooses the matching default action when the trigger changes', () => {
  assert.equal(defaultAutomationAction('Cobrança vencida', templates), 'Criar tarefa de revisão');
  assert.equal(defaultAutomationAction('Evento desconhecido', templates), '');
});

test('keeps a legacy action visible while editing but offers no unrelated options for a new trigger', () => {
  assert.deepEqual(automationActionOptions('Novo lead', 'Ação legada', templates), ['Criar follow-up', 'Ação legada']);
  assert.deepEqual(automationActionOptions('Evento desconhecido', '', templates), []);
});
