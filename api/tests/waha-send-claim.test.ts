import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { claimWahaMessage } from '../src/integrations/waha-send-claim.ts';

const now = new Date('2026-10-03T12:00:00.000Z');
const input = { sessionId: 'session-1', chatId: '5511987654321@c.us', clientMessageId: 'message-1', text: 'Olá' };

test('claims a new message while preserving the latest conversation fields', () => {
  const result = claimWahaMessage({ status: 'open', assigneeId: 'member-2', history: [] }, input, now);
  assert.equal(result.kind, 'claimed');
  if (result.kind !== 'claimed') return;
  assert.equal(result.data.status, 'open');
  assert.equal(result.data.assigneeId, 'member-2');
  assert.equal(result.data.whatsappSessionId, input.sessionId);
  assert.equal(result.pending.status, 'sending');
  assert.equal(result.pending.clientMessageId, input.clientMessageId);
});

test('a concurrent retry sees the first request claim and cannot claim another send', () => {
  const first = claimWahaMessage({ history: [] }, input, now);
  assert.equal(first.kind, 'claimed');
  if (first.kind !== 'claimed') return;
  assert.deepEqual(claimWahaMessage(first.data, input, new Date(now.getTime() + 1)), {
    kind: 'already_sending', messageId: input.clientMessageId,
  });
});

test('successful retries return the provider ID without claiming another send', () => {
  const result = claimWahaMessage({ history: [{ clientMessageId: input.clientMessageId, status: 'sent', providerMessageId: 'waha-123' }] }, input, now);
  assert.deepEqual(result, { kind: 'already_sent', messageId: 'waha-123' });
});

test('stale sending attempts can be retried with the same message ID', () => {
  const result = claimWahaMessage({ history: [{ clientMessageId: input.clientMessageId, status: 'sending', createdAt: new Date(now.getTime() - 30_000).toISOString() }] }, input, now);
  assert.equal(result.kind, 'claimed');
});

test('the WAHA route reserves the message under a conversation row lock before calling the provider', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.post('/api/integrations/waha/send'");
  const end = source.indexOf("app.post('/api/integrations/waha/webhook'", start);
  assert.ok(start >= 0 && end > start, 'WAHA send route should be present');
  const route = source.slice(start, end);
  const lock = route.indexOf(".for('update').limit(1)");
  const claim = route.indexOf('claimWahaMessage(currentData, body)');
  const providerCall = route.indexOf("'/api/sendText'");
  assert.ok(lock >= 0 && claim > lock, 'message claim must run after locking the latest conversation row');
  assert.ok(providerCall > claim, 'provider send must happen after the claim transaction');
});
