import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
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

test('new inbox conversations acquire the synchronous lock for both email and WhatsApp submissions', async () => {
  const source = await readFile(new URL('../screens/ServiceScreens.jsx', import.meta.url), 'utf8');
  const start = source.indexOf('const createConversation = async (event) =>');
  const end = source.indexOf('const updateConversationMetadata = async', start);
  assert.ok(start >= 0 && end > start, 'conversation submission handler is present');
  const handler = source.slice(start, end);
  assert.match(handler, /if \(sending \|\| inboxSendLock\.current\.locked\) return/);
  assert.equal((handler.match(/if \(!inboxSendLock\.current\.acquire\(\)\) return/g) || []).length, 2);
  assert.equal((handler.match(/inboxSendLock\.current\.release\(\)/g) || []).length, 2);
});
