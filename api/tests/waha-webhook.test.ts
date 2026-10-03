import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { appendWahaIncomingMessage, applyWahaMessageAck } from '../src/integrations/waha-webhook.ts';

const message = (messageId: string, text = messageId) => ({
  messageId, sessionId: 'session-1', chatId: '5511987654321@c.us', from: '5511987654321',
  text, timestamp: '2026-10-03T12:00:00.000Z', time: '09:00', displayName: 'Ana Lima',
});

test('a retried inbound WAHA message is idempotent and does not increment unread twice', () => {
  const first = appendWahaIncomingMessage(null, message('provider-1'))!;
  assert.equal(first.unread, 1);
  assert.equal(appendWahaIncomingMessage(first, message('provider-1')), null);
  assert.equal(first.unread, 1);
  assert.equal(first.history.length, 1);
});

test('different inbound messages append to the latest snapshot without losing either entry', () => {
  const first = appendWahaIncomingMessage(null, message('provider-1'))!;
  const second = appendWahaIncomingMessage(first, message('provider-2', 'Outra mensagem'))!;
  assert.deepEqual(second.history.map((entry: { providerMessageId: string }) => entry.providerMessageId), ['provider-1', 'provider-2']);
  assert.equal(second.unread, 2);
  assert.equal(second.text, 'Outra mensagem');
});

test('the first inbound event builds one complete conversation payload for atomic insert', () => {
  const created = appendWahaIncomingMessage(null, {
    ...message('provider-1'), clientId: 'client-1', clientName: 'Acme', clientEmail: 'ana@example.com', mediaFilename: 'brief.pdf',
  })!;
  assert.equal(created.whatsappSessionId, 'session-1');
  assert.equal(created.whatsappChatId, '5511987654321@c.us');
  assert.equal(created.clientId, 'client-1');
  assert.equal(created.company, 'Acme');
  assert.equal(created.email, 'ana@example.com');
  assert.equal(created.history[0].attachment, 'brief.pdf');
});

test('message ACK updates only the matching item in the latest history snapshot', () => {
  const current = { unread: 2, history: [
    { providerMessageId: 'provider-1', status: 'sent' },
    { providerMessageId: 'provider-2', status: 'sent' },
  ] };
  const next = applyWahaMessageAck(current, 'provider-1', 3)!;
  assert.equal(next.history[0].status, 'read');
  assert.equal(next.history[1].status, 'sent');
  assert.equal(next.unread, 2);
  assert.equal(applyWahaMessageAck(current, 'missing', 3), null);
});

test('WAHA webhook locks each organization/session/chat transaction before fresh lookup and mutation', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.post('/api/integrations/waha/webhook'");
  const end = source.indexOf("app.get('/api/integrations/google/authorize'", start);
  assert.ok(start >= 0 && end > start, 'WAHA webhook route should be present');
  const route = source.slice(start, end);
  assert.match(route, /x-nexo-waha-token/);
  const receivedTransaction = route.indexOf('await db.transaction(async (tx) => {', route.indexOf('if (payload.fromMe === true)'));
  const inboundRoute = route.slice(receivedTransaction);
  const advisoryLock = inboundRoute.indexOf('pg_advisory_xact_lock');
  const freshConversationLookup = inboundRoute.indexOf('tx.select().from(workspaceRecords)', advisoryLock);
  const rowLock = inboundRoute.indexOf(".for('update')", freshConversationLookup);
  const append = inboundRoute.indexOf('appendWahaIncomingMessage(', rowLock);
  const write = inboundRoute.indexOf('tx.update(workspaceRecords)', append);
  const create = inboundRoute.indexOf('tx.insert(workspaceRecords)', append);
  const activity = inboundRoute.indexOf('tx.insert(activityEvents)', Math.max(write, create));
  assert.ok(receivedTransaction >= 0 && advisoryLock >= 0, 'the chat advisory lock must be acquired in the DB transaction');
  assert.ok(freshConversationLookup > advisoryLock && rowLock > freshConversationLookup, 'the current inbox row must be read under the chat lock and row lock');
  assert.ok(append > rowLock && write > append && create > append, 'deduplication and both update/first-create paths must use the locked snapshot');
  assert.ok(activity > Math.max(write, create), 'activity must commit with the conversation mutation');
  assert.match(inboundRoute, /eq\(workspaceRecords\.organizationId, sessionRow\.organizationId\)/, 'the fresh conversation lookup must remain scoped to the owning organization');
  assert.match(inboundRoute, /eq\(workspaceRecords\.resource, 'inbox'\), isNull\(workspaceRecords\.archivedAt\)/, 'the fresh conversation lookup must ignore archived/non-inbox rows');
  assert.doesNotMatch(route, /oldHistory\.some/, 'deduplication must not use a snapshot read before the transaction');
  assert.equal((route.match(/pg_advisory_xact_lock/g) || []).length, 2, 'both inbound messages and ACK updates must serialize on the same chat lock');
});
