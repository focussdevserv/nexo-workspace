import assert from 'node:assert/strict';
import test from 'node:test';
import { googleCalendarErrorAction } from './google-calendar-error.js';

test('offers reauthorization for revoked tokens and Calendar scopes', () => {
  for (const code of ['google_reauthorization_required', 'google_calendar_scope_required', 'google_authorization_required']) {
    assert.equal(googleCalendarErrorAction(code), 'reauthorize');
  }
});

test('routes disconnected or misconfigured Google connections to Integrations', () => {
  assert.equal(googleCalendarErrorAction('integration_disconnected'), 'open_integrations');
  assert.equal(googleCalendarErrorAction('google_oauth_client_misconfigured'), 'open_integrations');
});

test('offers retry for transient and unknown calendar errors', () => {
  assert.equal(googleCalendarErrorAction('google_calendar_unavailable'), 'retry');
  assert.equal(googleCalendarErrorAction('unknown'), 'retry');
});
