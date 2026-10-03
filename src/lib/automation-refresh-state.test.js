import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveAutomationRefreshState } from './automation-refresh-state.js';

const oldWorkflows = { workflows: [{ id: 'old-workflow' }], executions: [{ id: 'old-run' }] };
const oldDelivery = [{ id: 'old-delivery' }];

test('keeps the last successful n8n and delivery snapshots visible on transient refresh failures', () => {
  const result = resolveAutomationRefreshState({ n8nData: oldWorkflows, deliveryHistory: oldDelivery }, {
    workflowResult: { status: 'rejected', reason: new Error('network unavailable') },
    deliveryResult: { status: 'rejected', reason: new Error('timeout') },
  });

  assert.equal(result.n8nData, oldWorkflows);
  assert.equal(result.deliveryHistory, oldDelivery);
  assert.equal(result.n8nError, 'network unavailable');
  assert.equal(result.deliveryError, 'timeout');
  assert.equal(result.n8nSetupRequired, false);
});

test('updates successful datasets independently while retaining data from the failed endpoint', () => {
  const nextDelivery = [{ id: 'new-delivery' }];
  const result = resolveAutomationRefreshState({ n8nData: oldWorkflows, deliveryHistory: oldDelivery }, {
    workflowResult: { status: 'rejected', reason: new Error('n8n timeout') },
    deliveryResult: { status: 'fulfilled', value: { data: nextDelivery } },
  });

  assert.equal(result.n8nData, oldWorkflows);
  assert.equal(result.deliveryHistory, nextDelivery);
  assert.equal(result.n8nError, 'n8n timeout');
  assert.equal(result.deliveryError, '');
});

test('uses a fresh successful workflow snapshot and reports unavailable setup without erasing the last snapshot', () => {
  const nextData = { workflows: [{ id: 'new-workflow' }], executions: [], deliveryQueue: { pending: 1 } };
  const updated = resolveAutomationRefreshState({ n8nData: oldWorkflows, deliveryHistory: oldDelivery }, {
    workflowResult: { status: 'fulfilled', value: { data: nextData } },
    deliveryResult: { status: 'fulfilled', value: { data: [] } },
  });
  assert.deepEqual(updated.n8nData, nextData);
  assert.deepEqual(updated.deliveryHistory, []);
  assert.equal(updated.n8nError, '');

  const setupMissing = resolveAutomationRefreshState({ n8nData: nextData, deliveryHistory: [] }, {
    workflowResult: { status: 'rejected', reason: Object.assign(new Error('n8n_not_configured'), { code: 'n8n_not_configured' }) },
    deliveryResult: { status: 'rejected', reason: new Error('integration_not_configured') },
  });
  assert.equal(setupMissing.n8nData, nextData);
  assert.equal(setupMissing.n8nSetupRequired, true);
  assert.equal(setupMissing.deliveryError, 'integration_not_configured');
});
