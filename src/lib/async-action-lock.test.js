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

test('rapid timer clicks persist only one running session', async () => {
  const lock = createAsyncActionLock();
  let releaseSave;
  let createdSessions = 0;
  const startTimer = () => lock.run(async () => {
    createdSessions += 1;
    await new Promise((resolve) => { releaseSave = resolve; });
  });

  const firstClick = startTimer();
  const secondClick = await startTimer();
  assert.deepEqual(secondClick, { ok: false, skipped: true });
  assert.equal(createdSessions, 1);
  releaseSave();
  await firstClick;
  assert.equal(lock.locked, false);
});

test('rapid agenda submissions persist a recurring series once and allow a later submission', async () => {
  const lock = createAsyncActionLock();
  let releaseSave;
  let persistedSeriesCount = 0;
  const submitAgenda = () => lock.run(async () => {
    persistedSeriesCount += 1;
    if (persistedSeriesCount === 1) await new Promise((resolve) => { releaseSave = resolve; });
    return { ok: true };
  });

  const firstSubmit = submitAgenda();
  assert.deepEqual(await submitAgenda(), { ok: false, skipped: true });
  assert.equal(persistedSeriesCount, 1);
  releaseSave();
  assert.deepEqual(await firstSubmit, { ok: true });
  assert.deepEqual(await submitAgenda(), { ok: true });
  assert.equal(persistedSeriesCount, 2);
});

test('skips an automatic status poll while a manual refresh is still in flight', async () => {
  const lock = createAsyncActionLock();
  let finishRefresh;
  let requests = 0;
  const manualRefresh = lock.run(async () => {
    requests += 1;
    await new Promise((resolve) => { finishRefresh = resolve; });
  });

  assert.deepEqual(await lock.run(async () => { requests += 1; }), { ok: false, skipped: true });
  assert.equal(requests, 1);
  finishRefresh();
  await manualRefresh;
  assert.deepEqual(await lock.run(async () => { requests += 1; }), undefined);
  assert.equal(requests, 2);
});

test('releases the lock when an action throws', async () => {
  const lock = createAsyncActionLock();
  await assert.rejects(lock.run(async () => { throw new Error('failed'); }), /failed/);
  assert.equal(lock.locked, false);
});
