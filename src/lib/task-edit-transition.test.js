import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskDetailsUpdate } from './task-edit-transition.js';

test('saving a completed recurring task keeps it completed and creates its next occurrence', () => {
  const tasks = [{ id: 'weekly', title: 'Review', due: '2026-10-02', recurrence: 'Semanal', state: 'Em andamento', status: 'Em andamento' }];
  const result = prepareTaskDetailsUpdate(tasks, 'weekly', { state: 'Concluída', status: 'Concluída' }, new Date(2026, 9, 2, 12));
  assert.equal(result.ok, true);
  assert.equal(result.tasks[0].state, 'Concluída');
  assert.equal(result.tasks[0].status, 'Concluída');
  assert.equal(result.occurrence.due, '2026-10-09');
  assert.equal(result.occurrence.status, 'A fazer');
});

test('does not complete a task through the detail editor while its prerequisite is open', () => {
  const tasks = [{ id: 'prep', title: 'Prepare' }, { id: 'send', title: 'Send', dependency: 'prep', status: 'A fazer', state: 'A fazer' }];
  const result = prepareTaskDetailsUpdate(tasks, 'send', { status: 'Concluída', state: 'Concluída' });
  assert.equal(result.ok, false);
  assert.match(result.error.message, /Prepare/);
});

test('rejects a dependency cycle without applying the edited task', () => {
  const tasks = [{ id: 'a', title: 'A', dependency: 'b' }, { id: 'b', title: 'B' }];
  const result = prepareTaskDetailsUpdate(tasks, 'b', { dependency: 'a' });
  assert.equal(result.ok, false);
  assert.match(result.error.message, /ciclo/);
  assert.equal(tasks[1].dependency, undefined);
});
