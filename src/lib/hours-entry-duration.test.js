import test from 'node:test';
import assert from 'node:assert/strict';
import { hoursEntryDurationInput, updateHoursEntryDuration } from './hours-entry-duration.js';

test('hours edit form uses stored seconds instead of rounded table hours', () => {
  assert.equal(hoursEntryDurationInput({ seconds: 600, hours: 0.17 }), '0.16666667');
  assert.equal(hoursEntryDurationInput({ seconds: 60, hours: 0.02 }), '0.01666667');
  assert.equal(hoursEntryDurationInput({ hours: 1.5 }), '1.50');
});

test('saving an unchanged rounded entry preserves its original elapsed seconds', () => {
  const entry = { id: 'ten-minute-entry', startedAt: '2026-10-02T12:00:00.000Z', endedAt: '2026-10-02T12:10:00.000Z', seconds: 600, hours: 0.17 };
  const saved = updateHoursEntryDuration(entry, Number(hoursEntryDurationInput(entry)));
  assert.equal(saved.seconds, 600);
  assert.equal(saved.endedAt, entry.endedAt);
});

test('keeps the end timestamp consistent when an entry duration is edited', () => {
  const entry = { id: 'entry-1', startedAt: '2026-10-02T12:00:00.000Z', endedAt: '2026-10-02T13:00:00.000Z', hours: 1, seconds: 3600 };
  assert.deepEqual(updateHoursEntryDuration(entry, 1.5), {
    ...entry,
    endedAt: '2026-10-02T13:30:00.000Z',
    hours: 1.5,
    seconds: 5400,
  });
});

test('preserves a legacy end timestamp when the start timestamp is unavailable', () => {
  const entry = { id: 'legacy', endedAt: '2026-10-02T13:00:00.000Z' };
  assert.deepEqual(updateHoursEntryDuration(entry, 2), { ...entry, hours: 2, seconds: 7200 });
});

test('rejects invalid or non-positive durations', () => {
  for (const duration of [0, -1, NaN, Infinity]) {
    assert.throws(() => updateHoursEntryDuration({}, duration), RangeError);
  }
});
