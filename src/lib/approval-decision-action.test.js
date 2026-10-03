import test from 'node:test';
import assert from 'node:assert/strict';
import { approvalDecisionWasSaved } from './approval-decision-action.js';

test('approval detail closes only after a confirmed decision save', () => {
  assert.equal(approvalDecisionWasSaved(true), true);
  assert.equal(approvalDecisionWasSaved(false), false);
  assert.equal(approvalDecisionWasSaved({ ok: false, skipped: true }), false);
  assert.equal(approvalDecisionWasSaved({ ok: false, error: new Error('offline') }), false);
});
