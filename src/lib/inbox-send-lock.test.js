import assert from 'node:assert/strict';
import test from 'node:test';
import { createInboxSendLock } from './inbox-send-lock.js';

test('blocks a rapid second inbox submit until the first delivery settles', () => {
  const lock = createInboxSendLock();
  let deliveries = 0;
  const submit = async () => {
    if (!lock.acquire()) return false;
    deliveries += 1;
    try { await new Promise((resolve) => setTimeout(resolve, 0)); return true; }
    finally { lock.release(); }
  };

  const first = submit();
  const duplicate = submit();
  return Promise.all([first, duplicate]).then(([sent, duplicateSent]) => {
    assert.equal(duplicateSent, false);
    assert.equal(sent, true);
    assert.equal(deliveries, 1);
    assert.equal(lock.locked, false);
    assert.equal(lock.acquire(), true);
    lock.release();
  });
});
