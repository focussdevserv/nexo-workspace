import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  decideGmailDeliveryReservation,
  runGmailDeliveryAttempt,
  type GmailDeliveryRecord,
} from '../src/integrations/gmail-delivery-idempotency.ts';

const now = new Date('2026-10-03T12:00:00.000Z');
const fingerprint = 'same-request-hash';

test('a new or explicitly rejected Gmail delivery may be claimed', () => {
  assert.deepEqual(decideGmailDeliveryReservation(null, fingerprint, now), { kind: 'claimed' });
  assert.deepEqual(decideGmailDeliveryReservation({ state: 'retryable', fingerprint, startedAt: now.toISOString(), attempts: 1 }, fingerprint, now), { kind: 'claimed' });
});

test('same key with different content conflicts; sent claims replay the original provider IDs', () => {
  const record: GmailDeliveryRecord = { state: 'sent', fingerprint, startedAt: now.toISOString(), attempts: 1, messageId: 'gmail-message', threadId: 'gmail-thread' };
  assert.deepEqual(decideGmailDeliveryReservation(record, 'different-request-hash', now), { kind: 'conflict' });
  assert.deepEqual(decideGmailDeliveryReservation(record, fingerprint, now), { kind: 'sent', record });
});

test('concurrent and stale Gmail claims do not issue another provider request', () => {
  const recent: GmailDeliveryRecord = { state: 'sending', fingerprint, startedAt: now.toISOString(), attempts: 1 };
  const stale: GmailDeliveryRecord = { ...recent, startedAt: new Date(now.getTime() - 30_001).toISOString() };
  assert.deepEqual(decideGmailDeliveryReservation(recent, fingerprint, now), { kind: 'sending' });
  assert.deepEqual(decideGmailDeliveryReservation(stale, fingerprint, now), { kind: 'unknown' });
});

test('mock provider acceptance is sent once and exact retry replays the saved result', async () => {
  let record: GmailDeliveryRecord | null = null;
  let providerCalls = 0;
  const persist = () => ({
    reserve: async () => {
      const decision = decideGmailDeliveryReservation(record, fingerprint, now);
      if (decision.kind === 'claimed') record = { state: 'sending', fingerprint, startedAt: now.toISOString(), attempts: (record?.attempts || 0) + 1 };
      return decision;
    },
    markRetryable: async () => { if (record) record = { ...record, state: 'retryable' }; },
    markUnknown: async () => { if (record) record = { ...record, state: 'unknown' }; },
    markSent: async (messageId: string, threadId?: string) => { if (record) record = { ...record, state: 'sent', messageId, threadId }; },
  });
  const first = await runGmailDeliveryAttempt({
    ...persist(), prepare: async () => 'prepared',
    deliver: async () => { providerCalls += 1; return { ok: true, status: 200, json: async () => ({ id: 'gmail-id', threadId: 'thread-id' }) }; },
  });
  const retry = await runGmailDeliveryAttempt({
    ...persist(), prepare: async () => 'prepared',
    deliver: async () => { providerCalls += 1; return { ok: true, status: 200, json: async () => ({ id: 'unexpected' }) }; },
  });
  assert.deepEqual(first, { kind: 'sent', messageId: 'gmail-id', threadId: 'thread-id' });
  assert.deepEqual(retry, { kind: 'sent', messageId: 'gmail-id', threadId: 'thread-id', duplicate: true });
  assert.equal(providerCalls, 1);
});

test('a provider timeout becomes terminal unknown and cannot be retried', async () => {
  let record: GmailDeliveryRecord | null = null;
  let providerCalls = 0;
  const options = () => ({
    reserve: async () => {
      const decision = decideGmailDeliveryReservation(record, fingerprint, now);
      if (decision.kind === 'claimed') record = { state: 'sending', fingerprint, startedAt: now.toISOString(), attempts: 1 };
      return decision;
    },
    prepare: async () => 'prepared',
    deliver: async () => { providerCalls += 1; throw new Error('socket timeout after POST'); },
    markRetryable: async () => { if (record) record = { ...record, state: 'retryable' }; },
    markUnknown: async () => { if (record) record = { ...record, state: 'unknown' }; },
    markSent: async () => {},
  });
  assert.deepEqual(await runGmailDeliveryAttempt(options()), { kind: 'unknown' });
  assert.deepEqual(await runGmailDeliveryAttempt(options()), { kind: 'unknown' });
  assert.equal(providerCalls, 1);
});

test('a preflight failure is retryable because Gmail was never called', async () => {
  let state: GmailDeliveryRecord['state'] = 'sending';
  let providerCalls = 0;
  const result = await runGmailDeliveryAttempt({
    reserve: async () => ({ kind: 'claimed' }),
    prepare: async () => { throw new Error('Google authorization expired'); },
    deliver: async () => { providerCalls += 1; return { ok: true, status: 200, json: async () => ({ id: 'id' }) }; },
    markRetryable: async () => { state = 'retryable'; }, markUnknown: async () => { state = 'unknown'; }, markSent: async () => {},
  });
  assert.equal(result.kind, 'preflight_failed');
  assert.equal(state, 'retryable');
  assert.equal(providerCalls, 0);
});

test('Gmail routes require the idempotency claim before any provider send', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  for (const routePath of ["app.post('/api/integrations/google/gmail/send'", "app.post('/api/integrations/google/gmail/:threadId/reply'"]) {
    const start = source.indexOf(routePath);
    const end = source.indexOf("\napp.", start + 1);
    const route = source.slice(start, end < 0 ? undefined : end);
    assert.ok(start >= 0, `missing route ${routePath}`);
    assert.match(route, /idempotency-key/i);
    assert.ok(route.indexOf('runGmailDeliveryAttempt') < route.indexOf('gmail.googleapis.com\/gmail\/v1\/users\/me\/messages\/send'));
    assert.match(route, /sendGmailDeliveryAttemptFailure/);
  }
  assert.match(source, /error: 'gmail_delivery_unknown'/);
});
