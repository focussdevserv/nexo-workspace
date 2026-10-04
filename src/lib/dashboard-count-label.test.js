import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardCountLabel } from './dashboard-count-label.js';

test('Meu Dia does not show zero counts while dashboard data is loading, failed, or restricted', () => {
  const label = { count: 0, singular: 'conversa', plural: 'conversas' };
  assert.equal(dashboardCountLabel({ ...label, loading: true }), 'Carregando…');
  assert.equal(dashboardCountLabel({ ...label, failed: true }), 'Não foi possível carregar');
  assert.equal(dashboardCountLabel({ ...label, restricted: true }), 'Sem acesso');
});

test('Meu Dia labels real counts with singular and plural wording', () => {
  assert.equal(dashboardCountLabel({ count: 0, singular: 'compromisso', plural: 'compromissos' }), '0 compromissos');
  assert.equal(dashboardCountLabel({ count: 1, singular: 'conversa', plural: 'conversas' }), '1 conversa');
  assert.equal(dashboardCountLabel({ count: 3, singular: 'conversa', plural: 'conversas' }), '3 conversas');
  assert.equal(dashboardCountLabel({ count: 3, countOnly: true }), '3');
});
