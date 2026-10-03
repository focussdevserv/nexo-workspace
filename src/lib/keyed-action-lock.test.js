import assert from 'node:assert/strict';
import test from 'node:test';
import { createKeyedActionLock } from './keyed-action-lock.js';

test('prevents duplicate concurrent actions for one record and allows a later retry', async () => {
  const locks = createKeyedActionLock();
  let release;
  let calls = 0;
  const first = locks.run('approval-1', async () => {
    calls += 1;
    await new Promise((resolve) => { release = resolve; });
    return { ok: true };
  });

  assert.deepEqual(await locks.run('approval-1', async () => { calls += 1; }), { ok: false, skipped: true });
  assert.equal(calls, 1);
  release();
  assert.deepEqual(await first, { ok: true });
  assert.deepEqual(await locks.run('approval-1', async () => ({ ok: true, retry: true })), { ok: true, retry: true });
});

test('keeps independent record actions independent and releases after errors', async () => {
  const locks = createKeyedActionLock();
  let release;
  const first = locks.run('approval-1', () => new Promise((resolve) => { release = resolve; }));
  assert.deepEqual(await locks.run('approval-2', async () => ({ ok: true })), { ok: true });
  release({ ok: true });
  await first;

  await assert.rejects(locks.run('approval-1', async () => { throw new Error('failed'); }), /failed/);
  assert.deepEqual(await locks.run('approval-1', async () => ({ ok: true })), { ok: true });
});

test('rapid completion clicks cannot create duplicate recurring task occurrences', async () => {
  const locks = createKeyedActionLock();
  let releaseSave;
  let occurrenceCount = 0;
  const complete = () => locks.run('recurring-task-1', async () => {
    occurrenceCount += 1;
    await new Promise((resolve) => { releaseSave = resolve; });
    return { ok: true };
  });

  const firstClick = complete();
  assert.deepEqual(await complete(), { ok: false, skipped: true });
  assert.equal(occurrenceCount, 1);
  releaseSave();
  assert.deepEqual(await firstClick, { ok: true });
  assert.deepEqual(await locks.run('recurring-task-1', async () => ({ ok: true, retry: true })), { ok: true, retry: true });
  assert.equal(occurrenceCount, 1);
});
