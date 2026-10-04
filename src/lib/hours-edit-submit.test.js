import assert from 'node:assert/strict';
import test from 'node:test';
import { createAsyncActionLock } from './async-action-lock.js';
import { submitHoursEditOnce } from './hours-edit-submit.js';

test('rapid edits of one hours record produce only one pending save', async () => {
  const lock = createAsyncActionLock();
  let release;
  let saves = 0;
  const submit = () => submitHoursEditOnce(lock, async () => {
    saves += 1;
    await new Promise((resolve) => { release = resolve; });
    return { ok: true };
  });

  const first = submit();
  assert.deepEqual(await submit(), { ok: false, skipped: true });
  assert.equal(saves, 1);
  release();
  assert.deepEqual(await first, { ok: true });
});
