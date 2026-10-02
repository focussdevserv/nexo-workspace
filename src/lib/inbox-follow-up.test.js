import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInboxFollowUpTask, nextInboxFollowUpDate } from './inbox-follow-up.js';

test('defaults inbox follow-up tasks to the next weekday', () => {
  assert.equal(nextInboxFollowUpDate(new Date(2026, 9, 2, 12)), '2026-10-05');
  assert.equal(nextInboxFollowUpDate(new Date(2026, 9, 5, 12)), '2026-10-06');
});

test('keeps follow-up task due date, canonical client link, owner and source conversation', () => {
  assert.deepEqual(buildInboxFollowUpTask(
    { id: 'conversation-7', name: 'Ana Costa', company: 'Acme', channel: 'WhatsApp' },
    { client: { id: 42, name: 'Acme Ltda.' }, assignee: 'João', due: '2026-10-08' },
  ), {
    title: 'Retornar para Ana Costa',
    project: 'Atendimento',
    client: 'Acme Ltda.',
    clientId: '42',
    due: '2026-10-08',
    assignee: 'João',
    status: 'A fazer',
    priority: 'Normal',
    sourceConversationId: 'conversation-7',
    sourceChannel: 'WhatsApp',
  });
});
