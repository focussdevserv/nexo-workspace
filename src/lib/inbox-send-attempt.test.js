import assert from 'node:assert/strict';
import test from 'node:test';
import { clearInboxSendAttempt, inboxSendAttemptId } from './inbox-send-attempt.js';

test('retries with the same payload reuse the idempotency key', () => {
  const attempt = { fingerprint: '', id: '' };
  let generated = 0;
  const createId = () => `message-${++generated}`;
  assert.equal(inboxSendAttemptId(attempt, 'same payload', createId), 'message-1');
  assert.equal(inboxSendAttemptId(attempt, 'same payload', createId), 'message-1');
  assert.equal(generated, 1);
});

test('editing the payload or succeeding starts a new send attempt', () => {
  const attempt = { fingerprint: '', id: '' };
  let generated = 0;
  const createId = () => `message-${++generated}`;
  assert.equal(inboxSendAttemptId(attempt, 'first payload', createId), 'message-1');
  assert.equal(inboxSendAttemptId(attempt, 'edited payload', createId), 'message-2');
  clearInboxSendAttempt(attempt);
  assert.equal(inboxSendAttemptId(attempt, 'edited payload', createId), 'message-3');
});
