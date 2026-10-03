import assert from 'node:assert/strict';
import test from 'node:test';
import { clearInboxSendAttempt, inboxSendAttemptId, persistedInboxSendAttemptId } from './inbox-send-attempt.js';

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

test('a pending Gmail attempt survives reload without storing its message content', async () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const firstTabAttempt = { fingerprint: '', id: '' };
  const id = await persistedInboxSendAttemptId(firstTabAttempt, 'private message contents', () => 'attempt-1', storage);
  const reloadedTabAttempt = { fingerprint: '', id: '' };
  const reloadedId = await persistedInboxSendAttemptId(reloadedTabAttempt, 'private message contents', () => 'attempt-2', storage);
  assert.equal(reloadedId, id);
  assert.equal([...values.keys()].some((key) => key.includes('private message contents')), false);
  assert.equal([...values.values()].includes('private message contents'), false);
  clearInboxSendAttempt(reloadedTabAttempt);
  assert.equal(values.size, 0);
});
