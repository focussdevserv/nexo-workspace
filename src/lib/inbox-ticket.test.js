import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInboxTicket, canCreateInboxTicket } from './inbox-ticket.js';

test('ticket creation follows support write access and keeps local demo available', () => {
  assert.equal(canCreateInboxTicket({ role: 'member', permissions: { support: { read: true, write: true } } }), true);
  assert.equal(canCreateInboxTicket({ role: 'member', permissions: { support: { read: true, write: false } } }), false);
  assert.equal(canCreateInboxTicket({ role: 'owner' }), true);
  assert.equal(canCreateInboxTicket(null, true), true);
});

test('ticket draft links the matched client and records channel, source, SLA and assignee', () => {
  const now = new Date('2026-10-03T10:00:00.000Z');
  const ticket = buildInboxTicket({ id: 'thread-9', threadId: 'thread-9', provider: 'hostinger', subject: 'Erro no acesso', name: 'Ana', email: 'ana@example.test', text: 'Não consigo entrar.' }, {
    channel: 'E-mail', client: { id: 'client-1', name: 'Acme' }, assignee: { id: 'team-2', name: 'João' }, author: 'Maria', now,
  });
  assert.equal(ticket.title, 'Erro no acesso');
  assert.equal(ticket.clientId, 'client-1');
  assert.equal(ticket.sourceChannel, 'Hostinger');
  assert.equal(ticket.sourceThreadId, 'thread-9');
  assert.equal(ticket.ownerId, 'team-2');
  assert.equal(ticket.slaDueAt, '2026-10-04T10:00:00.000Z');
  assert.match(ticket.detail, /Não consigo entrar/);
  assert.equal(buildInboxTicket({ id: 'unlinked' }, { channel: 'WhatsApp' }), null);
});
