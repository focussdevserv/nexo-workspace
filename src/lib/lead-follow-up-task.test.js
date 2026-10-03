import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLeadFollowUpTaskData, findOpenLeadFollowUpTask, isTerminalLeadStage } from './lead-follow-up-task.js';

test('finds the open task linked to the lead and ignores completed follow-ups', () => {
  const open = { id: 'task-open', sourceLeadId: 42, status: 'Em andamento' };
  assert.equal(findOpenLeadFollowUpTask([
    { id: 'task-done', sourceLeadId: '42', status: 'Concluída' },
    { id: 'inconsistent', sourceLeadId: '42', state: 'A fazer', status: 'Concluída' },
    open,
    { id: 'other', sourceLeadId: 'other', status: 'A fazer' },
  ], '42'), open);
  assert.equal(findOpenLeadFollowUpTask([
    { id: 'inconsistent', sourceLeadId: '42', state: 'A fazer', status: 'Concluída' },
  ], '42'), null);
  assert.equal(findOpenLeadFollowUpTask([{ id: 'unlinked', status: 'A fazer' }], '42'), null);
});

test('falls back to a legacy leadId when sourceLeadId is present but empty', () => {
  const legacyLinkedTask = { id: 'task-legacy', sourceLeadId: '', leadId: 'lead-7', status: 'A fazer' };
  assert.equal(findOpenLeadFollowUpTask([legacyLinkedTask], 'lead-7'), legacyLinkedTask);
  const whitespaceSourceIdTask = { ...legacyLinkedTask, sourceLeadId: '   ' };
  assert.equal(findOpenLeadFollowUpTask([whitespaceSourceIdTask], 'lead-7'), whitespaceSourceIdTask);
});

test('builds an active task payload linked to the lead and uses its owner and customer', () => {
  assert.deepEqual(buildLeadFollowUpTaskData({
    id: 'lead-1', name: 'Aline', company: 'Acme', owner: 'Joao', stage: 'Negociação',
  }, { action: 'Enviar proposta', due: '2026-10-06' }), {
    title: 'Enviar proposta',
    detail: 'Próxima ação do lead Aline',
    due: '2026-10-06',
    status: 'A fazer',
    state: 'A fazer',
    priority: 'Alta',
    assignee: 'Joao',
    client: 'Acme',
    clientId: '',
    sourceLeadId: 'lead-1',
    automationKey: 'lead-follow-up-manual',
  });
});

test('updates an existing task without changing its active state, priority, or identifiers', () => {
  const existing = { id: 'task-1', status: 'Em andamento', state: 'Em andamento', priority: 'Normal', recurrence: 'Semanal' };
  const payload = buildLeadFollowUpTaskData({ id: 'lead-1', name: 'Aline', stage: 'Novo lead' }, {
    action: 'Ligar novamente', due: '2026-10-07', existingTask: existing,
  });
  assert.equal(payload.id, 'task-1');
  assert.equal(payload.status, 'Em andamento');
  assert.equal(payload.priority, 'Normal');
  assert.equal(payload.recurrence, 'Semanal');
  assert.equal(payload.title, 'Ligar novamente');
  assert.equal(payload.due, '2026-10-07');
});

test('prevents scheduling for completed or lost leads and validates required action and date', () => {
  assert.equal(isTerminalLeadStage('Fechado'), true);
  assert.equal(isTerminalLeadStage('perdido'), true);
  assert.equal(isTerminalLeadStage('Negociação'), false);
  assert.throws(() => buildLeadFollowUpTaskData({ id: 'lead-1', stage: 'Fechado' }, { action: 'Ligar', due: '2026-10-06' }), /fechados ou perdidos/);
  assert.throws(() => buildLeadFollowUpTaskData({ id: 'lead-1', stage: 'Novo lead' }, { action: ' ', due: '2026-10-06' }), /próxima ação/);
  assert.throws(() => buildLeadFollowUpTaskData({ id: 'lead-1', stage: 'Novo lead' }, { action: 'Ligar', due: '' }), /data/);
});
