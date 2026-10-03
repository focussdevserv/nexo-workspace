import assert from 'node:assert/strict';
import test from 'node:test';
import { sendInboxMessage } from './inbox-send.js';

test('a successful delivery clears the composer even when inbox refresh fails', async () => {
  let sends = 0;
  let clears = 0;
  const result = await sendInboxMessage({
    deliver: async () => { sends += 1; },
    onSent: () => { clears += 1; },
    refresh: async () => { throw new Error('inbox unavailable'); },
  });

  assert.deepEqual(result, { sent: true, refreshed: false });
  assert.equal(sends, 1);
  assert.equal(clears, 1);
});

test('a delivery failure preserves the composer and never starts a refresh', async () => {
  let clears = 0;
  let refreshes = 0;
  await assert.rejects(sendInboxMessage({
    deliver: async () => { throw new Error('provider rejected'); },
    onSent: () => { clears += 1; },
    refresh: async () => { refreshes += 1; },
  }), /provider rejected/);

  assert.equal(clears, 0);
  assert.equal(refreshes, 0);
});
