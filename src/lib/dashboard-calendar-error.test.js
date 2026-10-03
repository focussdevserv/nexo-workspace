import assert from 'node:assert/strict';
import test from 'node:test';
import { dashboardCalendarError } from './dashboard-calendar-error.js';

test('disconnected Google Calendar points to integration settings', () => {
  assert.deepEqual(dashboardCalendarError({ code: 'integration_disconnected' }), {
    title: 'Google Calendar está desconectado',
    detail: 'Os compromissos salvos no Focusshub continuam visíveis. Reative a integração para consultar também os eventos do Google.',
    action: 'integrations',
    actionLabel: 'Abrir Integrações',
  });
});

test('missing or expired calendar authorization offers reauthorization', () => {
  for (const code of ['google_authorization_required', 'google_reauthorization_required', 'google_calendar_scope_required', 'google_token_refresh_unavailable', 'google_token_refresh_failed']) {
    assert.equal(dashboardCalendarError({ code }).action, 'authorize');
  }
});

test('members without integration administration get an owner handoff instead of a broken authorization link', () => {
  const state = dashboardCalendarError({ code: 'google_calendar_scope_required' }, false);
  assert.equal(state.action, null);
  assert.match(state.detail, /pessoa proprietária/);
});

test('temporary or unclassified calendar failures offer a safe retry', () => {
  assert.equal(dashboardCalendarError(new Error('offline')).action, 'retry');
  assert.equal(dashboardCalendarError({ code: 'google_calendar_read_failed' }).actionLabel, 'Tentar novamente');
});
