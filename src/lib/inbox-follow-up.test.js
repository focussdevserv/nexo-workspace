import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInboxFollowUpTask, createInboxFollowUpOnce, nextInboxFollowUpDate } from './inbox-follow-up.js';
import { createAsyncActionLock } from './async-action-lock.js';

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

test('prevents duplicate follow-up tasks on overlapping submits and allows retry after failure', async () => {
  const lock = createAsyncActionLock();
  let finish;
  let calls = 0;
  const first = createInboxFollowUpOnce(lock, async () => {
    calls += 1;
    await new Promise((resolve) => { finish = resolve; });
    return { ok: true };
  });
  assert.deepEqual(await createInboxFollowUpOnce(lock, async () => { calls += 1; }), { ok: false, skipped: true });
  finish();
  assert.deepEqual(await first, { ok: true });
  assert.equal(calls, 1);
  assert.deepEqual(await createInboxFollowUpOnce(lock, async () => { throw new Error('offline'); }).catch((error) => ({ message: error.message })), { message: 'offline' });
  assert.deepEqual(await createInboxFollowUpOnce(lock, async () => ({ ok: true })), { ok: true });
});
