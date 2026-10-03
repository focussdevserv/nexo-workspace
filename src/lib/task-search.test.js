import test from 'node:test';
import assert from 'node:assert/strict';
import { taskMatchesSearch } from './task-search.js';

const task = {
  title: 'Revisar proposta', project: 'Site da empresa', client: 'Acme', assignee: 'Mariana Costa',
  due: '2026-10-12', priority: 'Urgente', status: 'Em andamento', recurrence: 'Semanal',
  description: 'Conferir os valores e o escopo',
};

test('task search covers the fields people can see and filters by', () => {
  for (const query of ['Mariana', '2026-10-12', 'urgente', 'andamento', 'semanal', 'escopo']) {
    assert.equal(taskMatchesSearch(task, query), true, `expected search to match ${query}`);
  }
  assert.equal(taskMatchesSearch(task, 'outro cliente'), false);
});

test('task search is accent and case insensitive and empty query includes the task', () => {
  assert.equal(taskMatchesSearch({ ...task, assignee: 'João' }, 'JOAO'), true);
  assert.equal(taskMatchesSearch(task, '   '), true);
  assert.equal(taskMatchesSearch(null, 'tarefas'), false);
});
