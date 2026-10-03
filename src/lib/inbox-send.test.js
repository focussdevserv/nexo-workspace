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

  assert.deepEqual(result, { sent: true, refreshed: false, simulated: false });
  assert.equal(sends, 1);
  assert.equal(clears, 1);
});

test('keeps local demo delivery marked as simulated for truthful feedback', async () => {
  const result = await sendInboxMessage({
    deliver: async () => ({ data: { simulated: true } }),
    onSent: () => {},
    refresh: async () => {},
  });

  assert.deepEqual(result, { sent: true, refreshed: true, simulated: true });
});

test('a newly composed email is not reported as failed or left ready for duplicate send when refresh fails', async () => {
  let providerAcceptances = 0;
  let composerResets = 0;
  const result = await sendInboxMessage({
    deliver: async () => { providerAcceptances += 1; return { data: { id: 'provider-message-1' } }; },
    onSent: () => { composerResets += 1; },
    refresh: async () => { throw new Error('mailbox temporarily unavailable'); },
  });

  assert.equal(result.sent, true);
  assert.equal(result.refreshed, false);
  assert.equal(providerAcceptances, 1);
  assert.equal(composerResets, 1);
});

test('keeps the composer intact when WAHA reports the idempotent send is still pending', async () => {
  let clears = 0;
  let refreshes = 0;
  const result = await sendInboxMessage({
    deliver: async () => ({ data: { status: 'sending', duplicated: true } }),
    onSent: () => { clears += 1; },
    refresh: async () => { refreshes += 1; },
  });
  assert.deepEqual(result, { sent: false, refreshed: false, simulated: false, pending: true });
  assert.equal(clears, 0);
  assert.equal(refreshes, 1);
});

test('a delivery failure preserves the composer and does not refresh unless a handler requests it', async () => {
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

test('an uncertain delivery can refresh history while preserving the original send error', async () => {
  const expected = Object.assign(new Error('Confira o WhatsApp antes de enviar outra mensagem.'), { code: 'waha_delivery_unknown' });
  let refreshed = false;
  await assert.rejects(sendInboxMessage({
    deliver: async () => { throw expected; },
    onSent: () => {},
    refresh: async () => {},
    onDeliveryError: async (error) => { if (error.code === 'waha_delivery_unknown') refreshed = true; },
  }), (error) => error === expected);
  assert.equal(refreshed, true);
});
