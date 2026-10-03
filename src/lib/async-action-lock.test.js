import assert from 'node:assert/strict';
import test from 'node:test';
import { createAsyncActionLock } from './async-action-lock.js';

test('prevents concurrent submissions and releases after completion', async () => {
  const lock = createAsyncActionLock();
  let release;
  let calls = 0;
  const action = lock.run(async () => {
    calls += 1;
    await new Promise((resolve) => { release = resolve; });
    return { ok: true };
  });

  assert.deepEqual(await lock.run(async () => { calls += 1; }), { ok: false, skipped: true });
  assert.equal(calls, 1);
  release();
  assert.deepEqual(await action, { ok: true });
  assert.deepEqual(await lock.run(async () => ({ ok: true, retry: true })), { ok: true, retry: true });
});

test('releases the lock when an action throws', async () => {
  const lock = createAsyncActionLock();
  await assert.rejects(lock.run(async () => { throw new Error('failed'); }), /failed/);
  assert.equal(lock.locked, false);
});
