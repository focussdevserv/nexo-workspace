import test from 'node:test';
import assert from 'node:assert/strict';
import { averageProposalApprovalDays, countLeadsWithoutNextAction, formatElapsedDays } from './commercial-cycle-metrics.js';

test('counts open leads that need a next action and excludes completed or lost leads', () => {
  assert.equal(countLeadsWithoutNextAction([
    { stage: 'Novo lead' },
    { stage: 'Contato realizado', nextAction: 'Ligar amanhã' },
    { stage: 'Fechado' },
    { stage: 'Perdido' },
    { stage: 'Diagnóstico', nextAction: '   ' },
  ]), 2);
});

test('averages elapsed time only for approved proposals with valid creation and acceptance dates', () => {
  const result = averageProposalApprovalDays([
    { status: 'Aprovada', createdAt: '2026-10-01T00:00:00Z', acceptedAt: '2026-10-03T00:00:00Z' },
    { status: 'accepted', created_at: '2026-10-01T00:00:00Z', accepted_at: '2026-10-05T00:00:00Z' },
    { status: 'Enviada', createdAt: '2026-10-01T00:00:00Z', acceptedAt: '2026-10-02T00:00:00Z' },
    { status: 'Aprovada', createdAt: '2026-10-01T00:00:00Z' },
    { status: 'Aprovada', createdAt: '2026-10-04T00:00:00Z', acceptedAt: '2026-10-03T00:00:00Z' },
  ]);
  assert.deepEqual(result, { count: 2, days: 3 });
});

test('keeps the no-history state explicit and formats sub-day and plural durations', () => {
  assert.deepEqual(averageProposalApprovalDays([{ status: 'Aprovada' }]), { count: 0, days: null });
  assert.equal(formatElapsedDays(null), '—');
  assert.equal(formatElapsedDays(0.5), 'menos de 1 dia');
  assert.equal(formatElapsedDays(2.25), '2,3 dias');
  assert.equal(formatElapsedDays(1), '1 dia');
});
