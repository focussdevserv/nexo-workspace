import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { claimWahaMessage, markWahaDeliveryUnknown, markWahaPreflightFailure } from '../src/integrations/waha-send-claim.ts';

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

test('a stale or legacy sending attempt becomes unknown and cannot be sent again', () => {
  const result = claimWahaMessage({ history: [{ clientMessageId: input.clientMessageId, status: 'sending', createdAt: new Date(now.getTime() - 30_000).toISOString() }] }, input, now);
  assert.equal(result.kind, 'delivery_unknown');
  if (result.kind !== 'delivery_unknown') return;
  assert.equal((result.data.history as Array<Record<string, unknown>>)[0]?.status, 'unknown');
  assert.equal(claimWahaMessage(result.data, input, new Date(now.getTime() + 60_000)).kind, 'delivery_unknown');
  assert.equal(claimWahaMessage({ history: [{ clientMessageId: input.clientMessageId, status: 'sending' }] }, input, now).kind, 'delivery_unknown');
});

test('legacy failed sends without explicit preflight evidence are treated as unknown', () => {
  const result = claimWahaMessage({ history: [{ clientMessageId: input.clientMessageId, status: 'failed' }] }, input, now);
  assert.equal(result.kind, 'delivery_unknown');
});

test('only a confirmed pre-POST failure allows retry with the exact same payload', () => {
  const initial = claimWahaMessage({ history: [] }, input, now);
  assert.equal(initial.kind, 'claimed');
  if (initial.kind !== 'claimed') return;
  const failed = markWahaPreflightFailure(initial.data, input.clientMessageId);
  const entry = (failed.history as Array<Record<string, unknown>>)[0]!;
  assert.equal(entry.status, 'failed');
  assert.equal(entry.retryable, true);
  assert.equal(entry.failureStage, 'preflight');
  assert.equal(claimWahaMessage(failed, input, new Date(now.getTime() + 60_000)).kind, 'claimed');
  assert.equal(claimWahaMessage(failed, { ...input, text: 'Different body' }, new Date(now.getTime() + 60_000)).kind, 'idempotency_conflict');
});

test('an ambiguous provider result cannot be retried with the same ID', () => {
  const initial = claimWahaMessage({ history: [] }, input, now);
  assert.equal(initial.kind, 'claimed');
  if (initial.kind !== 'claimed') return;
  const unknown = markWahaDeliveryUnknown(initial.data, input.clientMessageId);
  assert.equal(claimWahaMessage(unknown, input, new Date(now.getTime() + 60_000)).kind, 'delivery_unknown');
});

test('an ambiguous provider result remains idempotent even if the pending bubble disappeared during a concurrent update', () => {
  const fallback = { clientMessageId: input.clientMessageId, side: 'sent', text: input.text, status: 'sending', createdAt: now.toISOString() };
  const unknown = markWahaDeliveryUnknown({ history: [] }, input.clientMessageId, fallback);
  assert.equal((unknown.history as Array<Record<string, unknown>>)[0]?.status, 'unknown');
  assert.equal(claimWahaMessage(unknown, input, new Date(now.getTime() + 60_000)).kind, 'delivery_unknown');
});

test('confirmed delivery remains idempotent after provider ACK and when WAHA omits its ID', () => {
  for (const status of ['sent', 'delivered', 'read']) {
    const result = claimWahaMessage({ history: [{ clientMessageId: input.clientMessageId, status, providerMessageId: 'waha-123' }] }, input, now);
    assert.deepEqual(result, { kind: 'already_sent', messageId: 'waha-123' });
  }
  const withoutProviderId = claimWahaMessage({ history: [{ clientMessageId: input.clientMessageId, status: 'sent', providerMessageId: '' }] }, input, now);
  assert.deepEqual(withoutProviderId, { kind: 'already_sent', messageId: input.clientMessageId });
});

test('the WAHA route reserves the message under a conversation row lock before calling the provider', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.post('/api/integrations/waha/send'");
  const end = source.indexOf("app.post('/api/integrations/waha/webhook'", start);
  assert.ok(start >= 0 && end > start, 'WAHA send route should be present');
  const route = source.slice(start, end);
  const lock = route.indexOf(".for('update').limit(1)");
  const claim = route.indexOf('claimWahaMessage(currentData, body)');
  const providerCall = route.indexOf('sendPostStarted = true');
  const post = route.indexOf('wahaRequest<{ id?: string }>(sendPath');
  assert.ok(lock >= 0 && claim > lock, 'message claim must run after locking the latest conversation row');
  assert.ok(providerCall > claim && post > providerCall, 'provider send must be explicitly marked ambiguous immediately before its POST');
  const postCommit = route.indexOf("await db.transaction(async (tx) => {", post);
  const postCommitRowLock = route.indexOf(".for('update').limit(1)", postCommit);
  assert.ok(postCommit > post && postCommitRowLock > postCommit, 'the post-send status must be committed from a freshly locked conversation');
  assert.match(route.slice(postCommit, postCommitRowLock), /eq\(workspaceRecords\.organizationId, request\.user\.organizationId\).*eq\(workspaceRecords\.resource, 'inbox'\), isNull\(workspaceRecords\.archivedAt\)/s);
  assert.match(route, /statusCode === 409 \? 409 : 502\)\.send\(\{ error: 'waha_send_preflight_failed'/);
  assert.match(route, /error: 'waha_delivery_unknown'/);
});
