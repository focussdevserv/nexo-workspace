import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTaskDueDate, isTaskDueDate, taskDueDateInput, taskLegacyDueText, withTaskDueDate } from './task-due-date.js';
import { prepareTaskDetailsUpdate } from './task-edit-transition.js';

test('accepts only real calendar dates as task deadlines', () => {
  assert.equal(isTaskDueDate('2026-10-15'), true);
  assert.equal(isTaskDueDate('2026-02-30'), false);
  assert.equal(isTaskDueDate('30 set'), false);
  assert.equal(isTaskDueDate(''), false);
});

test('date input starts empty for missing or legacy free-text deadlines', () => {
  assert.equal(taskDueDateInput({ due: '2026-10-15' }), '2026-10-15');
  assert.equal(taskDueDateInput({ due: '30 set' }), '');
  assert.equal(taskDueDateInput({ due: 'A definir' }), '');
  assert.equal(taskLegacyDueText({ due: '30 set' }), '30 set');
  assert.equal(taskLegacyDueText({ due: 'A definir' }), '');
  assert.equal(taskLegacyDueText({ due: '2026-10-15' }), '');
});

test('editing the deadline stores an ISO date and clearing it stores the create-flow placeholder', () => {
  assert.equal(withTaskDueDate({ due: '30 set' }, '2026-09-30').due, '2026-09-30');
  assert.equal(withTaskDueDate({ due: '2026-09-30' }, '').due, 'A definir');
});

test('moving a monthly occurrence re-anchors the next occurrence on the new day', () => {
  const task = { id: 'm', title: 'Relatorio', recurrence: 'Mensal', recurrenceAnchorDay: 31, recurrenceSequence: 2, due: '2026-10-31', status: 'A fazer', state: 'A fazer' };
  const moved = withTaskDueDate(task, '2026-10-15');
  assert.equal(moved.recurrenceAnchorDay, 15);
  const result = prepareTaskDetailsUpdate([task], 'm', { ...moved, status: 'Concluída', state: 'Concluída' }, new Date(2026, 9, 10, 12));
  assert.equal(result.occurrence.due, '2026-11-15');
});

test('a deadline edited through the detail form drives the next recurring occurrence', () => {
  const task = { id: 'w', title: 'Revisao', recurrence: 'Semanal', due: '30 set', status: 'A fazer', state: 'A fazer' };
  const edited = withTaskDueDate(task, '2026-10-20');
  const result = prepareTaskDetailsUpdate([task], 'w', { ...edited, status: 'Concluída', state: 'Concluída' }, new Date(2026, 9, 4, 12));
  assert.equal(result.occurrence.due, '2026-10-27');
});

test('formats deadlines for the task list without shifting the calendar day', () => {
  assert.match(formatTaskDueDate('2026-10-01'), /^01/);
  assert.equal(formatTaskDueDate('30 set'), '30 set');
  assert.equal(formatTaskDueDate('A definir'), 'Sem prazo');
  assert.equal(formatTaskDueDate(''), 'Sem prazo');
});
