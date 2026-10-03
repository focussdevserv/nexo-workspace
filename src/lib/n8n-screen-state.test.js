import assert from 'node:assert/strict';
import test from 'node:test';
import { n8nSetupActionRequired } from './n8n-screen-state.js';

test('shows the integration setup action for missing or paused n8n connections', () => {
  assert.equal(n8nSetupActionRequired('n8n_not_configured'), true);
  assert.equal(n8nSetupActionRequired('integration_not_configured'), true);
  assert.equal(n8nSetupActionRequired('integration_disconnected'), true);
});

test('does not route provider failures or permission errors to integration setup', () => {
  assert.equal(n8nSetupActionRequired('n8n_request_failed'), false);
  assert.equal(n8nSetupActionRequired('n8n_api_forbidden'), false);
  assert.equal(n8nSetupActionRequired(undefined), false);
});
