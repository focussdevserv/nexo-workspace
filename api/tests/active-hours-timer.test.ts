import assert from 'node:assert/strict';
import test from 'node:test';
import { findOtherRunningHoursTimer } from '../src/security/active-hours-timer.ts';

test('workspace has only one active timer, ignoring completed entries and the timer being edited', () => {
  const rows = [
    { id: 'done', status: 'completed' },
    { id: 'active', status: 'running' },
  ];

  assert.equal(findOtherRunningHoursTimer(rows), rows[1]);
  assert.equal(findOtherRunningHoursTimer(rows, 'active'), null);
  assert.equal(findOtherRunningHoursTimer([{ id: 'paused', status: 'paused' }]), null);
});
