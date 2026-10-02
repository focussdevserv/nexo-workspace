import test from 'node:test';
import assert from 'node:assert/strict';
import { updateKeyedBusyState } from './keyed-busy-state.js';

test('finishing one concurrent repository sync leaves the other loading', () => {
  const idle = new Set();
  const withFirst = updateKeyedBusyState(idle, 10, true);
  const withBoth = updateKeyedBusyState(withFirst, '20', true);
  const firstFinished = updateKeyedBusyState(withBoth, '10', false);

  assert.deepEqual([...withBoth].sort(), ['10', '20']);
  assert.deepEqual([...firstFinished], ['20']);
  assert.deepEqual([...idle], []);
});

test('repeated completion is safe and does not affect other keys', () => {
  const pending = updateKeyedBusyState(new Set(['repo-a', 'repo-b']), 'repo-a', false);
  const repeated = updateKeyedBusyState(pending, 'repo-a', false);

  assert.deepEqual([...pending], ['repo-b']);
  assert.deepEqual([...repeated], ['repo-b']);
});
