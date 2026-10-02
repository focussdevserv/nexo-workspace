import test from 'node:test';
import assert from 'node:assert/strict';
import { createLatestRequestGuard } from './latest-request.js';

test('latest request guard ignores a response from a previous selection', () => {
  const guard = createLatestRequestGuard();
  const firstRequest = guard.begin();
  const secondRequest = guard.begin();

  assert.equal(guard.isCurrent(firstRequest), false);
  assert.equal(guard.isCurrent(secondRequest), true);
});

test('latest request guard invalidates requests after selection cleanup', () => {
  const guard = createLatestRequestGuard();
  const request = guard.begin();

  guard.invalidate();

  assert.equal(guard.isCurrent(request), false);
});

test('latest request guard ignores a result after the user changes the search target', () => {
  const guard = createLatestRequestGuard();
  const oldRepositoryRequest = guard.begin();

  guard.invalidate();

  assert.equal(guard.isCurrent(oldRepositoryRequest), false);
});
