import test from 'node:test';
import assert from 'node:assert/strict';
import { isTaskCompleted, taskOccurrenceMatches, taskRecurrenceIdentity, validNextTaskOccurrence } from '../src/tasks/recurring-task-transition.ts';

const current = { title: 'Rotina', due: '2026-10-01', recurrence: 'Diaria', status: 'A fazer', state: 'A fazer' };
const next = { title: 'Rotina', due: '2026-10-02', recurrence: 'Diaria', recurrenceId: 'task-1', recurrenceSequence: 2, status: 'A fazer', state: 'A fazer' };

test('uses the persisted task ID as recurrence identity for its first occurrence', () => {
  assert.deepEqual(taskRecurrenceIdentity('task-1', current), { recurrenceId: 'task-1', sequence: 1, nextSequence: 2 });
});

test('recognizes legacy completion aliases and accents', () => {
  assert.equal(isTaskCompleted({ state: 'Concluída', status: 'A fazer' }), true);
  assert.equal(isTaskCompleted({ status: 'Pendente', state: 'A fazer' }), false);
});

test('accepts a matching open next occurrence after completion', () => {
  assert.equal(validNextTaskOccurrence('task-1', current, { status: 'Concluída', state: 'Concluída' }, next), true);
});

test('rejects a mismatched series, sequence, title, completed next task, or invalid date', () => {
  const patch = { status: 'Concluída', state: 'Concluída' };
  assert.equal(validNextTaskOccurrence('task-1', current, patch, { ...next, recurrenceId: 'other' }), false);
  assert.equal(validNextTaskOccurrence('task-1', current, patch, { ...next, recurrenceSequence: 3 }), false);
  assert.equal(validNextTaskOccurrence('task-1', current, patch, { ...next, title: 'Other' }), false);
  assert.equal(validNextTaskOccurrence('task-1', current, patch, { ...next, status: 'Concluída' }), false);
  assert.equal(validNextTaskOccurrence('task-1', current, patch, { ...next, due: '2026-02-30' }), false);
});

test('does not accept a next occurrence for a non-recurring task', () => {
  assert.equal(validNextTaskOccurrence('once', { ...current, recurrence: 'Nao recorrente' }, { status: 'Concluída' }, next), false);
});

test('accepts a retry only when the existing next occurrence is the same record', () => {
  assert.equal(taskOccurrenceMatches(next, next), true);
  assert.equal(taskOccurrenceMatches({ ...next, title: 'Outro' }, next), false);
  assert.equal(taskOccurrenceMatches({ ...next, due: '2026-10-03' }, next), false);
  assert.equal(taskOccurrenceMatches({ ...next, recurrenceSequence: 3 }, next), false);
});
