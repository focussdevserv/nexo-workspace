import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLeadNavigation } from './lead-navigation-context.js';

test('keeps lead navigation pending until records finish loading', () => {
  const lead = { id: 'lead-1', name: 'Ana' };

  assert.deepEqual(resolveLeadNavigation([lead], lead.id, { loading: true }), { status: 'waiting', lead: null });
});

test('resolves the requested lead by string-equivalent record ID', () => {
  const lead = { id: 42, name: 'Ana' };

  assert.deepEqual(resolveLeadNavigation([lead], '42'), { status: 'found', lead });
});

test('does not consume an unresolved lead context after a failed load', () => {
  assert.deepEqual(resolveLeadNavigation([], 'lead-404', { loadError: 'network failure' }), { status: 'waiting', lead: null });
});

test('reports a lead as missing only after a successful record load', () => {
  assert.deepEqual(resolveLeadNavigation([{ id: 'other' }], 'lead-404'), { status: 'missing', lead: null });
});

test('ignores an empty lead context', () => {
  assert.deepEqual(resolveLeadNavigation([{ id: 'lead-1' }], ''), { status: 'none', lead: null });
});
