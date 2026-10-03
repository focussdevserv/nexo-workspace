import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeyedActionLock } from './keyed-action-lock.js';
import { submitApprovalComment } from './approval-comment-action.js';

test('approval comment action saves trimmed text once when submits overlap', async () => {
  const locks = createKeyedActionLock();
  let release;
  let calls = 0;
  const save = async (text) => {
    calls += 1;
    assert.equal(text, 'Looks good');
    await new Promise((resolve) => { release = resolve; });
    return { ok: true };
  };

  const first = submitApprovalComment({ locks, approvalId: 'approval-1', text: '  Looks good  ', save });
  const duplicate = await submitApprovalComment({ locks, approvalId: 'approval-1', text: 'Looks good', save });

  assert.deepEqual(duplicate, { ok: false, skipped: true });
  assert.equal(calls, 1);
  release();
  assert.deepEqual(await first, { ok: true });
});

test('approval comment action allows retry after an unsuccessful save', async () => {
  const locks = createKeyedActionLock();
  assert.deepEqual(await submitApprovalComment({ locks, approvalId: 'approval-2', text: '   ', save: async () => ({ ok: true }) }), { ok: false, invalid: true });
  assert.deepEqual(await submitApprovalComment({ locks, approvalId: 'approval-2', text: 'Need revision', save: async () => ({ ok: false }) }), { ok: false });
  assert.deepEqual(await submitApprovalComment({ locks, approvalId: 'approval-2', text: 'Need revision', save: async () => ({ ok: true }) }), { ok: true });
});
