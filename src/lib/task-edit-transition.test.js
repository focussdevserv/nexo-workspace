import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTaskDetailsUpdate, saveTaskDetailsOnce } from './task-edit-transition.js';
import { createKeyedActionLock } from './keyed-action-lock.js';

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

test('overlapping detail saves do not create two next occurrences for one recurring task', async () => {
  const locks = createKeyedActionLock();
  const tasks = [{ id: 'daily', title: 'Review', due: '2026-10-02', recurrence: 'Diaria', status: 'A fazer' }];
  let releaseSave;
  let calls = 0;
  const options = {
    locks, tasks, taskId: 'daily',
    patch: { status: 'Concluída' },
    now: new Date(2026, 9, 2, 12),
    save: async (nextTasks) => {
      calls += 1;
      assert.equal(nextTasks.length, 2);
      await new Promise((resolve) => { releaseSave = resolve; });
      return { ok: true };
    },
  };
  const first = saveTaskDetailsOnce(options);
  assert.deepEqual(await saveTaskDetailsOnce(options), { ok: false, skipped: true });
  assert.equal(calls, 1);
  releaseSave();
  const saved = await first;
  assert.equal(saved.ok, true);
  assert.equal(saved.transition.occurrence.due, '2026-10-03');
});
