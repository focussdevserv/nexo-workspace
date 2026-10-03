import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardTaskCompletionBlocker } from './dashboard-task-completion.js';

test('Meu Dia blocks completion while the prerequisite is open', () => {
  const prerequisite = { id: 'brief', title: 'Aprovar briefing', status: 'Em andamento' };
  const task = { id: 'build', title: 'Montar página', dependency: 'brief', status: 'Pendente' };

  assert.equal(dashboardTaskCompletionBlocker([prerequisite, task], task), prerequisite);
});

test('Meu Dia allows completion when the prerequisite is done', () => {
  const prerequisite = { id: 'brief', title: 'Aprovar briefing', status: 'Concluída' };
  const task = { id: 'build', title: 'Montar página', dependency: 'brief', status: 'Pendente' };

  assert.equal(dashboardTaskCompletionBlocker([prerequisite, task], task), null);
});

test('Meu Dia allows reopening a completed task even if its prerequisite is open', () => {
  const prerequisite = { id: 'brief', title: 'Aprovar briefing', status: 'Pendente' };
  const task = { id: 'build', title: 'Montar página', dependency: 'brief', status: 'Concluída' };

  assert.equal(dashboardTaskCompletionBlocker([prerequisite, task], task), null);
});
