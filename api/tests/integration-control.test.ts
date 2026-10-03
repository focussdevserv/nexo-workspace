import assert from 'node:assert/strict';
import test from 'node:test';
import { integrationControlAllowsUse } from '../src/integrations/integration-control.js';

test('integration use is allowed by default and can be explicitly paused', () => {
  assert.equal(integrationControlAllowsUse(undefined), true);
  assert.equal(integrationControlAllowsUse(null), true);
  assert.equal(integrationControlAllowsUse({}), true);
  assert.equal(integrationControlAllowsUse({ enabled: true }), true);
  assert.equal(integrationControlAllowsUse({ enabled: false }), false);
});
