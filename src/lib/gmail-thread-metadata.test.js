import test from 'node:test';
import assert from 'node:assert/strict';
import { gmailThreadMetadataRecord, hostingerThreadMetadataRecord, mergeGmailThreadMetadata, mergeHostingerThreadMetadata } from './gmail-thread-metadata.js';

test('merges owner and status by Gmail thread ID without replacing provider messages', () => {
  const threads = [{ id: 't1', threadId: 't1', text: 'Latest mail', unread: 1 }];
  const records = [{ id: 'r1', channel: 'Gmail', gmailMetadata: true, threadId: 't1', owner: 'Ana', assigneeId: 'u1', status: 'closed' }];
  assert.deepEqual(mergeGmailThreadMetadata(threads, records), [{ ...threads[0], owner: 'Ana', assigneeId: 'u1', status: 'closed', resolvedAt: '', emailMetadataId: 'r1' }]);
});

test('does not merge WhatsApp records or metadata for a different Gmail thread', () => {
  const threads = [{ id: 't1', threadId: 't1' }];
  const records = [{ id: 'r1', channel: 'WhatsApp', gmailMetadata: true, threadId: 't1' }, { id: 'r2', channel: 'Gmail', gmailMetadata: true, threadId: 't2' }];
  assert.deepEqual(mergeGmailThreadMetadata(threads, records), threads);
});

test('preserves existing assignment when updating only the thread status', () => {
  const result = gmailThreadMetadataRecord({ id: 't1', name: 'Client' }, { status: 'closed' }, { owner: 'Ana', assigneeId: 'u1' });
  assert.equal(result.status, 'closed');
  assert.equal(result.owner, 'Ana');
  assert.equal(result.assigneeId, 'u1');
});

test('reopens a resolved thread when a newer message arrives', () => {
  const threads = [{ id: 't1', threadId: 't1', time: '2026-09-02T12:00:00.000Z' }];
  const records = [{ id: 'r1', channel: 'Gmail', gmailMetadata: true, threadId: 't1', status: 'closed', resolvedAt: '2026-09-01T12:00:00.000Z' }];
  assert.equal(mergeGmailThreadMetadata(threads, records)[0].status, 'open');
});

test('persists Hostinger assignment and status independently from Gmail metadata', () => {
  const thread = { id: 'hostinger:12', threadId: 'hostinger:12', name: 'Client', time: '2026-09-02T12:00:00.000Z' };
  const record = hostingerThreadMetadataRecord(thread, { status: 'closed' }, { owner: 'Ana', assigneeId: 'u1' });
  assert.equal(record.hostingerMetadata, true);
  assert.equal(record.owner, 'Ana');
  assert.equal(mergeHostingerThreadMetadata([thread], [{ ...record, id: 'r1' }])[0].status, 'closed');
  assert.deepEqual(mergeGmailThreadMetadata([thread], [{ ...record, id: 'r1' }]), [thread]);
});

test('reopens a resolved Hostinger thread when a later message arrives', () => {
  const thread = { id: 'hostinger:12', threadId: 'hostinger:12', time: '2026-09-02T12:00:00.000Z' };
  const row = { id: 'r1', channel: 'E-mail', hostingerMetadata: true, threadId: 'hostinger:12', status: 'closed', resolvedAt: '2026-09-01T12:00:00.000Z' };
  assert.equal(mergeHostingerThreadMetadata([thread], [row])[0].status, 'open');
});
