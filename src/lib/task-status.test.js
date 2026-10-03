import test from 'node:test';
import assert from 'node:assert/strict';
import { taskIsCompleted, taskMatchesStatus, taskStatusForEdit, withTaskStatus } from './task-status.js';

test('task completion recognizes either legacy status field when the values disagree', () => {
  assert.equal(taskIsCompleted({ state: 'Pendente', status: 'Concluída' }), true);
  assert.equal(taskIsCompleted({ state: 'Concluída', status: 'A fazer' }), true);
  assert.equal(taskIsCompleted({ state: 'Pendente', status: 'A fazer' }), false);
});

test('task completion ignores surrounding whitespace in legacy status fields', () => {
  assert.equal(taskIsCompleted({ state: ' A fazer ', status: ' Concluída ' }), true);
  assert.equal(taskMatchesStatus({ status: ' Concluída ' }, 'Concluída'), true);
});

test('completed task filter includes completed legacy records regardless of which field was updated', () => {
  assert.equal(taskMatchesStatus({ state: 'Pendente', status: 'Concluída' }, 'Concluída'), true);
  assert.equal(taskMatchesStatus({ state: 'Concluída', status: 'A fazer' }, 'Concluída'), true);
  assert.equal(taskMatchesStatus({ state: 'Pendente', status: 'A fazer' }, 'Concluída'), false);
});

test('task detail status edits keep legacy state and status fields in sync', () => {
  const legacyDone = { id: 'legacy', state: 'Concluída', status: 'A fazer' };
  assert.equal(taskStatusForEdit(legacyDone), 'Concluída');
  const reopened = withTaskStatus(legacyDone, 'A fazer');
  assert.equal(reopened.state, 'A fazer');
  assert.equal(reopened.status, 'A fazer');
  assert.equal(taskIsCompleted(reopened), false);

  const completed = withTaskStatus({ id: 'open', state: 'A fazer', status: 'A fazer' }, 'Concluída');
  assert.equal(taskIsCompleted(completed), true);
  assert.equal(taskStatusForEdit(completed), 'Concluída');
});

test('task detail normalizes legacy statuses to visible options', () => {
  assert.equal(taskStatusForEdit({ status: '  pendente ' }), 'A fazer');
  assert.equal(taskStatusForEdit({ status: 'TODO' }), 'A fazer');
  assert.equal(taskStatusForEdit({ status: ' em andamento ' }), 'Em andamento');
  assert.equal(taskStatusForEdit({ state: 'Pendente', status: 'Concluída' }), 'Concluída');
});