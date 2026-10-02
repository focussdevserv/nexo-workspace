import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardMetricNavigation } from './dashboard-metric-navigation.js';

test('Meu Dia summary shortcuts open their matching workspace modules', () => {
  assert.deepEqual(dashboardMetricNavigation('leads'), { page: 'Leads' });
  assert.deepEqual(dashboardMetricNavigation('projects'), { page: 'Projetos' });
  assert.deepEqual(dashboardMetricNavigation('tasks'), { page: 'Tarefas' });
  assert.deepEqual(dashboardMetricNavigation('events'), { page: 'Agenda' });
  assert.deepEqual(dashboardMetricNavigation('receivables'), { page: 'Cobranças' });
});

test('the overdue shortcut preserves the finance filter and unknown metrics stay inert', () => {
  assert.deepEqual(dashboardMetricNavigation('overdue'), { page: 'Cobranças', context: { filter: 'overdue' } });
  assert.equal(dashboardMetricNavigation('unknown'), null);
});
