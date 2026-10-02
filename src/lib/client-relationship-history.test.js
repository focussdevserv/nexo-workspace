import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClientRelationshipHistory, clientRelationshipHistoryDateLabel } from './client-relationship-history.js';

test('client relationship history combines CRM, delivery, support, documents, and finance chronologically', () => {
  const rows = buildClientRelationshipHistory({
    notes: [{ id: 'note', text: 'Aprovar identidade', at: '2026-10-01T09:00:00Z' }],
    events: [{ id: 'event', title: 'Cliente criado', at: '2026-09-30T09:00:00Z' }],
    finance: [{ id: 'bill', kind: 'Cobrança', description: 'Mensalidade', date: '2026-10-02T09:00:00Z', status: 'Pendente', amount: 350 }],
    projects: [{ id: 'project', name: 'Site institucional', status: 'Em andamento', createdAt: '2026-10-01T12:00:00Z' }],
    tasks: [{ id: 'task', title: 'Revisar layout', status: 'Aberta', dueDate: '2026-10-01T10:00:00Z' }],
    tickets: [{ id: 'ticket', code: 'NX-3', title: 'Ajuste no domínio', status: 'Aberto', createdAt: '2026-09-29T10:00:00Z' }],
    approvals: [{ id: 'approval', title: 'Versão inicial', status: 'Pendente', sentAt: '2026-10-01T11:00:00Z' }],
    contracts: [{ id: 'contract', title: 'Contrato de suporte', status: 'Assinado', updatedAt: '2026-09-28T12:00:00Z' }],
    files: [{ id: 'file', name: 'briefing.pdf', createdAt: '2026-09-27T12:00:00Z' }],
  });

  assert.deepEqual(rows.map(({ kind }) => kind), ['Financeiro', 'Projeto', 'Aprovação', 'Tarefa', 'Nota', 'Atividade', 'Ticket', 'Contrato', 'Arquivo']);
  assert.equal(rows[0].amount, 350);
  assert.match(rows[2].detail, /Pendente/);
});

test('history ignores undated and invalid records instead of inventing chronology', () => {
  const rows = buildClientRelationshipHistory({
    notes: [{ id: 'no-date', text: 'Sem data' }],
    tickets: [{ id: 'bad-date', title: 'Ticket', createdAt: 'invalid' }],
    files: [{ id: 'valid', name: 'Contrato.pdf', date: '2026-10-02' }],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'Arquivo:valid');
  assert.equal(rows[0].date, '2026-10-02');
  assert.equal(clientRelationshipHistoryDateLabel(rows[0].date), '02/10/2026');
});

test('client timeline keeps calendar-only finance dates from shifting to the prior day', () => {
  const [row] = buildClientRelationshipHistory({
    finance: [{ id: 'revenue', kind: 'Receita', description: 'Consultoria', date: '2026-10-02', status: 'Recebida', amount: 250 }],
  });
  assert.equal(row.date, '2026-10-02');
  assert.equal(clientRelationshipHistoryDateLabel(row.date), '02/10/2026');
});
