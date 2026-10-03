import test from 'node:test';
import assert from 'node:assert/strict';
import { taskDependencyBlocker, taskDependencyBlockMessage, taskDependencyWouldCreateCycle, tasksDependingOn } from './task-dependency.js';

const tasks = [
  { id: 'prep', title: 'Aprovar briefing', status: 'Em andamento' },
  { id: 'publish', title: 'Publicar campanha', status: 'A fazer', dependency: 'prep' },
];

test('blocks a task while its referenced dependency is still open', () => {
  assert.equal(taskDependencyBlocker(tasks, tasks[1]), tasks[0]);
  assert.equal(taskDependencyBlockMessage(tasks[0]), 'Conclua “Aprovar briefing” antes de finalizar esta tarefa.');
});

test('allows completion after the dependency is completed, including accented status', () => {
  const completed = [{ ...tasks[0], status: 'Concluída' }, tasks[1]];
  assert.equal(taskDependencyBlocker(completed, completed[1]), null);
  assert.equal(taskDependencyBlocker([{ id: 'prep', state: 'done' }, tasks[1]], tasks[1]), null);
});

test('does not keep a dependent task blocked when the legacy state field marks its prerequisite complete', () => {
  const inconsistent = [{ ...tasks[0], status: 'Em andamento', state: 'Concluída' }, tasks[1]];
  assert.equal(taskDependencyBlocker(inconsistent, inconsistent[1]), null);
});

test('does not block tasks with no dependency, a removed dependency, or a self reference', () => {
  assert.equal(taskDependencyBlocker(tasks, { id: 'independent' }), null);
  assert.equal(taskDependencyBlocker(tasks, { id: 'later', dependency: 'removed' }), null);
  assert.equal(taskDependencyBlocker(tasks, { id: 'same', dependency: 'same' }), null);
});

test('finds open tasks that depend on a prerequisite before it is deleted', () => {
  assert.deepEqual(tasksDependingOn(tasks, 'prep'), [tasks[1]]);
  assert.deepEqual(tasksDependingOn(tasks, 'publish'), []);
  assert.deepEqual(tasksDependingOn(tasks, ''), []);
});

test('detects direct and transitive dependency cycles before saving', () => {
  const chain = [
    { id: 'a', dependency: '' },
    { id: 'b', dependency: 'a' },
    { id: 'c', dependency: 'b' },
    { id: 'free', dependency: '' },
  ];
  assert.equal(taskDependencyWouldCreateCycle(chain, 'a', 'b'), true);
  assert.equal(taskDependencyWouldCreateCycle(chain, 'a', 'c'), true);
  assert.equal(taskDependencyWouldCreateCycle(chain, 'c', 'free'), false);
  assert.equal(taskDependencyWouldCreateCycle(chain, 'a', ''), false);
});
