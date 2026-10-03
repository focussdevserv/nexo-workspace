import assert from 'node:assert/strict';
import test from 'node:test';
import { googleEmailErrorAction } from './google-email-error.js';

test('requests Google reauthorization for missing consent, revoked access, or Gmail scope', () => {
  for (const code of ['google_authorization_required', 'google_reauthorization_required', 'google_gmail_scope_required']) {
    assert.equal(googleEmailErrorAction(code), 'reauthorize');
  }
});

test('sends integration setup errors to configuration and transient errors to retry', () => {
  assert.equal(googleEmailErrorAction('integration_not_configured'), 'configure');
  assert.equal(googleEmailErrorAction('integration_disconnected'), 'configure');
  assert.equal(googleEmailErrorAction('google_gmail_unavailable'), 'retry');
  assert.equal(googleEmailErrorAction('unknown'), 'retry');
});
