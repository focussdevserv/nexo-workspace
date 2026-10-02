import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardMetricPresentation } from './dashboard-metric-presentation.js';

test('Meu Dia does not present failed metric sources as real zeroes', () => {
  assert.deepEqual(dashboardMetricPresentation({ failed: true, value: 0, detail: 'em andamento' }), {
    value: '—',
    detail: 'Não foi possível carregar',
  });
});

test('Meu Dia keeps permission and loading states clear before showing metric data', () => {
  assert.equal(dashboardMetricPresentation({ restricted: true, loading: true, value: 0 }).value, '—');
  assert.equal(dashboardMetricPresentation({ loading: true, failed: true, value: 0 }).value, '…');
  assert.deepEqual(dashboardMetricPresentation({ value: 0, detail: 'em andamento' }), {
    value: '0',
    detail: 'em andamento',
  });
});
