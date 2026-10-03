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

test('latest request guard ignores an overlapping stale refresh', () => {
  const guard = createLatestRequestGuard();
  const olderRequest = guard.begin();
  const newerRequest = guard.begin();

  assert.equal(guard.isCurrent(olderRequest), false);
  assert.equal(guard.isCurrent(newerRequest), true);
});

test('latest request guard ignores inbox email results after leaving the email channel', () => {
  const guard = createLatestRequestGuard();
  const emailRequest = guard.begin();

  guard.invalidate();

  assert.equal(guard.isCurrent(emailRequest), false);
});
