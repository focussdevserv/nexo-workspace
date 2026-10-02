import assert from 'node:assert/strict';
import test from 'node:test';
import { buildN8nAutomationWorkflow, mapN8nCollections, n8nApiKeyFailureMessage, n8nApiValidationMessage, n8nAutomationTemplates, n8nProposalTaskMatchesSource, n8nWorkflowActionEndpoint, n8nWorkflowsEndpoint } from '../src/integrations/n8n.ts';

test('maps automation publish actions to n8n public API endpoints', () => {
  assert.equal(n8nWorkflowActionEndpoint('publish'), 'activate');
  assert.equal(n8nWorkflowActionEndpoint('unpublish'), 'deactivate');
});

test('builds n8n workflow pagination URLs with opaque cursors safely encoded', () => {
  assert.equal(n8nWorkflowsEndpoint(), '/workflows?limit=100');
  assert.equal(n8nWorkflowsEndpoint('next/+ cursor'), '/workflows?limit=100&cursor=next%2F%2B%20cursor');
});

test('distinguishes an invalid n8n API key from missing workflow scopes', () => {
  assert.match(n8nApiKeyFailureMessage(401), /chave.*ativa/i);
  assert.match(n8nApiKeyFailureMessage(403), /escopos.*workflow:list.*workflow:read/i);
});

test('surfaces safe n8n validation details and suppresses server internals', () => {
  assert.match(n8nApiValidationMessage(400, { message: 'body.nodes should NOT have additional properties' }), /body\.nodes/);
  assert.match(n8nApiValidationMessage(500, { message: 'database password=secret' }), /erro interno/);
  assert.equal(n8nApiValidationMessage(400, { details: 'secret' }), 'n8n recusou a solicitação com HTTP 400.');
});

test('maps n8n workflow and execution lists to safe summaries', () => {
  const mapped = mapN8nCollections([
    { id: 'wf-1', name: 'New lead', active: true, triggerCount: 1, updatedAt: '2026-09-24T10:00:00.000Z', nodes: [{ credentials: { token: 'must-not-leak' } }] },
    { id: 25, name: 'invalid id' },
    null,
  ], [
    { id: 'exec-1', workflowId: 'wf-1', status: 'success', mode: 'webhook', startedAt: '2026-09-24T10:01:00.000Z', data: { customerEmail: 'private@example.com' } },
    { id: 'exec-2', workflowId: 'deleted', status: 'unexpected', stoppedAt: 'invalid-date', data: { password: 'must-not-leak' } },
  ]);

  assert.deepEqual(mapped, {
    workflows: [{ id: 'wf-1', name: 'New lead', active: true, triggerCount: 1, updatedAt: '2026-09-24T10:00:00.000Z' }],
    executions: [
      { id: 'exec-1', workflowId: 'wf-1', workflowName: 'New lead', status: 'success', startedAt: '2026-09-24T10:01:00.000Z', stoppedAt: null, mode: 'webhook' },
      { id: 'exec-2', workflowId: 'deleted', workflowName: 'Workflow removido', status: 'unknown', startedAt: null, stoppedAt: null, mode: null },
    ],
  });
  assert.equal(JSON.stringify(mapped).includes('must-not-leak'), false);
  assert.equal(JSON.stringify(mapped).includes('private@example.com'), false);
});

test('handles empty or malformed n8n list entries', () => {
  assert.deepEqual(mapN8nCollections([{}, 'invalid'], [null, {}]), { workflows: [], executions: [] });
});

test('proposal checklist tasks do not suppress the distinct n8n follow-up action', () => {
  const proposalId = 'proposal-123';
  assert.equal(n8nProposalTaskMatchesSource({ sourceProposalId: proposalId, title: 'Preparar homepage' }, proposalId), false);
  assert.equal(n8nProposalTaskMatchesSource({ automationKey: 'n8n:proposal', sourceProposalId: proposalId }, proposalId), true);
  assert.equal(n8nProposalTaskMatchesSource({ automationKey: 'n8n:proposal', sourceProposalId: 'other-proposal' }, proposalId), false);
});

test('creates authenticated webhook workflows without retaining execution data', () => {
  const workflow = buildN8nAutomationWorkflow({
    automationId: '9b68be20-4709-45f5-9b29-668b21e7fd12', templateId: 'new-lead-follow-up',
    name: 'Lead follow-up', webhookPath: 'nexo/6d206c5b-0671-4662-99dc-f9297dc41df0',
    callbackUrl: 'https://focussdev.space/api/integrations/n8n/actions', credentialId: 'nexo-bridge-v1',
  });
  assert.equal(workflow.nodes[0]?.parameters.authentication, 'headerAuth');
  assert.equal(workflow.nodes[0]?.parameters.path, 'nexo/6d206c5b-0671-4662-99dc-f9297dc41df0');
  assert.equal(workflow.nodes[0]?.parameters.responseMode, 'lastNode');
  assert.equal(workflow.nodes[0]?.credentials.httpHeaderAuth.id, 'nexo-bridge-v1');
  assert.equal(workflow.nodes[1]?.parameters.url, 'https://focussdev.space/api/integrations/n8n/actions');
  assert.equal(workflow.nodes[1]?.credentials.httpHeaderAuth.id, 'nexo-bridge-v1');
  assert.notEqual(workflow.active, true, 'new workflows must remain drafts until explicitly published');
  assert.equal(workflow.settings.saveDataSuccessExecution, 'none');
  assert.equal(workflow.settings.saveDataErrorExecution, 'none');
  assert.equal(workflow.settings.saveManualExecutions, false);
  assert.equal(Object.hasOwn(workflow, 'meta'), false);
  assert.equal(JSON.stringify(workflow).includes('credential-secret'), false);
  assert.deepEqual(n8nAutomationTemplates['new-lead-follow-up'], { eventKey: 'lead.created', taskKind: 'lead' });
  assert.deepEqual(n8nAutomationTemplates['overdue-payment-reminder'], { eventKey: 'payment.overdue', taskKind: 'overduePayment' });
});
