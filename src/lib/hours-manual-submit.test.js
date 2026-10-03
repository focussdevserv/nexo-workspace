import assert from 'node:assert/strict';
import test from 'node:test';
import { createAsyncActionLock } from './async-action-lock.js';
import { submitManualHoursOnce } from './hours-manual-submit.js';

test('rapid manual-hours submissions persist a time entry only once', async () => {
  const lock = createAsyncActionLock();
  let releaseSave;
  let persistedEntries = 0;
  const submit = () => submitManualHoursOnce(lock, async () => {
    persistedEntries += 1;
    await new Promise((resolve) => { releaseSave = resolve; });
    return { ok: true };
  });

  const first = submit();
  assert.deepEqual(await submit(), { ok: false, skipped: true });
  assert.equal(persistedEntries, 1);
  releaseSave();
  assert.deepEqual(await first, { ok: true });
  assert.deepEqual(await submitManualHoursOnce(lock, async () => ({ ok: true })), { ok: true });
});

test('manual-hours submission helper rejects an invalid persistence action', async () => {
  assert.deepEqual(await submitManualHoursOnce(null, async () => ({ ok: true })), { ok: false, invalid: true });
  assert.deepEqual(await submitManualHoursOnce(createAsyncActionLock(), null), { ok: false, invalid: true });
});
