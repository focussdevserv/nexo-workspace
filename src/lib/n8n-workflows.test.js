import assert from 'node:assert/strict';
import test from 'node:test';
import { appendUniqueN8nWorkflows } from './n8n-workflows.js';

test('appends workflow pages without duplicating items at cursor boundaries', () => {
  const first = [{ id: 'wf-1', name: 'One' }, { id: 'wf-2', name: 'Two' }];
  assert.deepEqual(appendUniqueN8nWorkflows(first, [{ id: 'wf-2', name: 'Two updated' }, { id: 'wf-3', name: 'Three' }]), [
    { id: 'wf-1', name: 'One' }, { id: 'wf-2', name: 'Two' }, { id: 'wf-3', name: 'Three' },
  ]);
});

test('deduplicates repeated ids within a provider page and tolerates malformed pages', () => {
  const page = [{ id: 'wf-2', name: 'Two' }, { id: 'wf-2', name: 'Duplicate' }, null, { name: 'Missing id' }];
  assert.deepEqual(appendUniqueN8nWorkflows([], page), [{ id: 'wf-2', name: 'Two' }]);
  assert.deepEqual(appendUniqueN8nWorkflows(null, null), []);
});
