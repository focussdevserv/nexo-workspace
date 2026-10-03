import assert from 'node:assert/strict';
import test from 'node:test';
import { isReportProjectActive, isReportProjectCompleted } from './report-project-status.js';

test('report project metrics do not count archived, paused, or cancelled work as active', () => {
  for (const status of ['Arquivado', 'archived', 'Pausado', 'Paused', 'Cancelada', 'cancelled']) {
    assert.equal(isReportProjectActive({ status }), false, `${status} should be inactive`);
  }
});

test('report project metrics recognize completed statuses with accents and legacy state fields', () => {
  assert.equal(isReportProjectCompleted({ status: 'Concluído' }), true);
  assert.equal(isReportProjectCompleted({ state: 'completed' }), true);
  assert.equal(isReportProjectActive({ status: 'Aguardando cliente' }), true);
  assert.equal(isReportProjectActive({ status: 'Em andamento' }), true);
  assert.equal(isReportProjectActive({}), true);
});
