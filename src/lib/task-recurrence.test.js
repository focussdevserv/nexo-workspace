import test from 'node:test';
import assert from 'node:assert/strict';
import { completeTaskOccurrence, nextRecurringTask } from './task-recurrence.js';

test('returns the completed task and next occurrence together as one saveable update', () => {
  const task = { id: 'a', title: 'Backup', due: '2026-10-01', recurrence: 'Diaria', checklist: [{ title: 'Verificar', done: true }], comments: [{ text: 'feito' }] };
  const result = completeTaskOccurrence([task], 'a', new Date(2026, 9, 1, 12));
  assert.equal(result.tasks.length, 2);
  assert.equal(result.tasks[1].id, result.occurrence.id);
  assert.equal(result.tasks[0].status, 'Concluída');
  assert.equal(result.occurrence.due, '2026-10-02');
  assert.equal(result.occurrence.state, 'A fazer');
  assert.equal(result.occurrence.status, 'A fazer');
  assert.equal(result.occurrence.checklist[0].done, false);
  assert.deepEqual(result.occurrence.comments, []);
});

test('keeps monthly recurrence on the last valid day and skips dates already past', () => {
  const occurrence = nextRecurringTask([], { id: 'monthly', title: 'Fechar mês', due: '2026-01-31', recurrence: 'Mensal' }, new Date(2026, 2, 5));
  assert.equal(occurrence.due, '2026-03-31');
});

test('keeps the original monthly anchor after February shortens the due date', () => {
  const first = nextRecurringTask([], { id: 'month-end', title: 'Month end', due: '2026-01-31', recurrence: 'Mensal' }, new Date(2026, 0, 31));
  assert.equal(first.due, '2026-02-28');
  const second = nextRecurringTask([first], first, new Date(2026, 1, 28));
  assert.equal(second.due, '2026-03-31');
  assert.equal(second.recurrenceAnchorDay, 31);
});

test('reopening a task does not create a recurrence and completion does not duplicate its next occurrence', () => {
  const task = { id: 'weekly', title: 'Revisar', due: '2026-10-01', recurrence: 'Semanal', status: 'Concluída' };
  const reopened = completeTaskOccurrence([task], 'weekly', new Date(2026, 9, 1));
  assert.equal(reopened.tasks[0].status, 'A fazer');
  assert.equal(reopened.occurrence, null);
  const next = { id: 'weekly-2', title: task.title, recurrence: 'Semanal', recurrenceId: 'weekly', recurrenceSequence: 2, due: '2026-10-08' };
  assert.equal(nextRecurringTask([task, next], task, new Date(2026, 9, 1)), null);
});

test('does not create an occurrence for non-recurring tasks', () => {
  assert.equal(nextRecurringTask([], { id: 'once', recurrence: 'Nao recorrente' }), null);
});

test('keeps recurring state and status aligned so the next occurrence remains open', () => {
  const result = completeTaskOccurrence([{ id: 'legacy', title: 'Rotina', due: '2026-10-01', recurrence: 'Semanal', state: 'Pendente', status: 'Pendente' }], 'legacy', new Date(2026, 9, 1));
  assert.equal(result.tasks[0].state, result.tasks[0].status);
  assert.equal(result.occurrence.state, 'A fazer');
  assert.equal(result.occurrence.status, 'A fazer');
});

test('reopens a legacy task when either state field says it was completed', () => {
  const task = { id: 'legacy-done', state: 'Concluída', status: 'A fazer', recurrence: 'Semanal' };
  const result = completeTaskOccurrence([task], task.id, new Date(2026, 9, 1));
  assert.equal(result.occurrence, null);
  assert.equal(result.tasks[0].state, 'A fazer');
  assert.equal(result.tasks[0].status, 'A fazer');
});

test('reopening a completed legacy task with padded status does not create another occurrence', () => {
  const task = { id: 'padded-done', state: ' A fazer ', status: ' Concluída ', recurrence: 'Diaria' };
  const result = completeTaskOccurrence([task], task.id, new Date(2026, 9, 1));
  assert.equal(result.occurrence, null);
  assert.equal(result.tasks[0].state, 'A fazer');
  assert.equal(result.tasks[0].status, 'A fazer');
});
