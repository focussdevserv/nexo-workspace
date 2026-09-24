import assert from 'node:assert/strict';
import test from 'node:test';
import { mapN8nCollections } from '../src/integrations/n8n.ts';

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
