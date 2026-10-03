import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommercialSubmissionLock } from './commercial-submission-lock.js';

test('allows one in-flight create and permits retry after it settles', () => {
  const lock = createCommercialSubmissionLock();
  assert.equal(lock.acquire(), true);
  assert.equal(lock.acquire(), false);
  lock.release();
  assert.equal(lock.acquire(), true);
});

test('release is safe after a rejected create attempt', () => {
  const lock = createCommercialSubmissionLock();
  assert.equal(lock.acquire(), true);
  lock.release();
  assert.equal(lock.acquire(), true);
});
