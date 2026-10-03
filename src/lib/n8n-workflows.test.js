import assert from 'node:assert/strict';
import test from 'node:test';
import { appendUniqueN8nWorkflows } from './n8n-workflows.js';

test('appends workflow pages without duplicating items at cursor boundaries', () => {
  const first = [{ id: 'wf-1', name: 'One' }, { id: 'wf-2', name: 'Two' }];
  assert.deepEqual(appendUniqueN8nWorkflows(first, [{ id: 'wf-2', name: 'Two updated' }, { id: 'wf-3', name: 'Three' }]), [
    { id: 'wf-1', name: 'One' }, { id: 'wf-2', name: 'Two updated' }, { id: 'wf-3', name: 'Three' },
  ]);
});

test('uses the latest paginated n8n workflow state without moving its list position', () => {
  const current = [{ id: 'wf-1', name: 'One', active: false }, { id: 'wf-2', name: 'Two', active: false }];
  const next = [{ id: 'wf-1', name: 'One', active: true }, { id: 'wf-3', name: 'Three', active: false }];
  assert.deepEqual(appendUniqueN8nWorkflows(current, next), [
    { id: 'wf-1', name: 'One', active: true }, { id: 'wf-2', name: 'Two', active: false }, { id: 'wf-3', name: 'Three', active: false },
  ]);
});

test('deduplicates repeated ids within a provider page and tolerates malformed pages', () => {
  const page = [{ id: 'wf-2', name: 'Two' }, { id: 'wf-2', name: 'Duplicate' }, null, { name: 'Missing id' }];
  assert.deepEqual(appendUniqueN8nWorkflows([], page), [{ id: 'wf-2', name: 'Duplicate' }]);
  assert.deepEqual(appendUniqueN8nWorkflows(null, null), []);
});
