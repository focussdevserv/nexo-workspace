import test from 'node:test';
import assert from 'node:assert/strict';
import { completeTaskOccurrence, nextRecurringTask } from './task-recurrence.js';

test('creates a daily occurrence after completing a task and resets its checklist', () => {
  const task = { id: 'a', title: 'Backup', due: '2026-10-01', recurrence: 'Diaria', checklist: [{ title: 'Verificar', done: true }], comments: [{ text: 'feito' }] };
  const result = completeTaskOccurrence([task], 'a', new Date(2026, 9, 1, 12));
  assert.equal(result.tasks[0].status, 'Concluída');
  assert.equal(result.occurrence.due, '2026-10-02');
  assert.equal(result.occurrence.status, 'A fazer');
  assert.equal(result.occurrence.checklist[0].done, false);
  assert.deepEqual(result.occurrence.comments, []);
});

test('keeps monthly recurrence on the last valid day and skips dates already past', () => {
  const occurrence = nextRecurringTask([], { id: 'monthly', title: 'Fechar mês', due: '2026-01-31', recurrence: 'Mensal' }, new Date(2026, 2, 5));
  assert.equal(occurrence.due, '2026-03-31');
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
