import test from 'node:test';
import assert from 'node:assert/strict';
import { taskIsCompleted, taskMatchesStatus } from './task-status.js';

test('task completion recognizes either legacy status field when the values disagree', () => {
  assert.equal(taskIsCompleted({ state: 'Pendente', status: 'Concluída' }), true);
  assert.equal(taskIsCompleted({ state: 'Concluída', status: 'A fazer' }), true);
  assert.equal(taskIsCompleted({ state: 'Pendente', status: 'A fazer' }), false);
});

test('completed task filter includes completed legacy records regardless of which field was updated', () => {
  assert.equal(taskMatchesStatus({ state: 'Pendente', status: 'Concluída' }, 'Concluída'), true);
  assert.equal(taskMatchesStatus({ state: 'Concluída', status: 'A fazer' }, 'Concluída'), true);
  assert.equal(taskMatchesStatus({ state: 'Pendente', status: 'A fazer' }, 'Concluída'), false);
});
