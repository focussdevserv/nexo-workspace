import test from 'node:test';
import assert from 'node:assert/strict';
import { findProjectClient } from './project-client-link.js';

const clients = [
  { id: 'client-1', name: 'Cliente Nexo' },
  { id: 'client-2', name: 'Cliente Duplicado' },
  { id: 'client-3', title: 'Cliente Duplicado' },
];

test('project client ID takes precedence over a display name', () => {
  assert.equal(findProjectClient({ clientId: 'client-1', client: 'Outro nome' }, clients), clients[0]);
});

test('links a legacy project by an unambiguous client name', () => {
  assert.equal(findProjectClient({ client: ' cliente nexo ' }, clients), clients[0]);
});

test('does not guess when a legacy project name matches multiple clients', () => {
  assert.equal(findProjectClient({ client: 'Cliente Duplicado' }, clients), null);
});

test('returns no client for unlinked projects', () => {
  assert.equal(findProjectClient({ client: 'Sem cliente' }, clients), null);
  assert.equal(findProjectClient(null, clients), null);
});

