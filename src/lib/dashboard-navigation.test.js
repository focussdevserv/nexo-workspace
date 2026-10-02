import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRefreshDashboardOnNavigation } from './dashboard-navigation.js';

test('refreshes dashboard when the user returns from another screen', () => {
  assert.equal(shouldRefreshDashboardOnNavigation('Tarefas', 'Meu Dia', true), true);
  assert.equal(shouldRefreshDashboardOnNavigation('Agenda', 'Meu Dia', true), true);
});

test('does not refresh on initial render, while staying on dashboard, or when navigating away', () => {
  assert.equal(shouldRefreshDashboardOnNavigation('Meu Dia', 'Meu Dia', false), false);
  assert.equal(shouldRefreshDashboardOnNavigation('Agenda', 'Meu Dia', false), false);
  assert.equal(shouldRefreshDashboardOnNavigation('Meu Dia', 'Tarefas', true), false);
});
