import assert from 'node:assert/strict';
import test from 'node:test';
import { canCreateTaskFromHours, canWriteTaskFromHours, createdHoursTaskId } from './hours-task-selection.js';

test('offers task creation from Hours only after load and when the user can write', () => {
  const ready = { tasksLoaded: true, tasksError: '', timerRunning: false, hasActiveTask: false, canWriteTask: true };
  assert.equal(canCreateTaskFromHours(ready), true);
  assert.equal(canCreateTaskFromHours({ ...ready, tasksLoaded: false }), false);
  assert.equal(canCreateTaskFromHours({ ...ready, tasksError: new Error('offline') }), false);
  assert.equal(canCreateTaskFromHours({ ...ready, timerRunning: true }), false);
  assert.equal(canCreateTaskFromHours({ ...ready, hasActiveTask: true }), false);
  assert.equal(canCreateTaskFromHours({ ...ready, canWriteTask: false }), false);
});

test('matches task creation UI access to the API delivery permission policy', () => {
  assert.equal(canWriteTaskFromHours('member', undefined), true); // baseline POST /tasks grant
  assert.equal(canWriteTaskFromHours('member', {}), true);
  assert.equal(canWriteTaskFromHours('member', { delivery: { read: true } }), false);
  assert.equal(canWriteTaskFromHours('member', { delivery: { write: false } }), false);
  assert.equal(canWriteTaskFromHours('member', { delivery: { read: true, write: true } }), true);
  assert.equal(canWriteTaskFromHours('owner', { delivery: { write: false } }), true);
  assert.equal(canWriteTaskFromHours('admin', { delivery: { write: false } }), true);
});

test('uses the persisted workspace ID for a task created from Hours', () => {
  assert.equal(createdHoursTaskId({
    ok: true,
    records: [{ id: 'persisted-task-id' }],
    createdIds: { 'temporary-task-id': 'persisted-task-id' },
  }, 'temporary-task-id'), 'persisted-task-id');
});

test('does not select a task when saving failed or the created record is unconfirmed', () => {
  assert.equal(createdHoursTaskId({ ok: false, records: [] }, 'temporary-task-id'), '');
  assert.equal(createdHoursTaskId({ ok: true, records: [] }, 'temporary-task-id'), '');
});
