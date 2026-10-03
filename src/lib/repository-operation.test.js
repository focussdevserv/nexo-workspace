import assert from 'node:assert/strict';
import test from 'node:test';
import { canStartRepositoryOperation } from './repository-operation.js';

test('allows starting an operation when the repository is idle', () => {
  assert.equal(canStartRepositoryOperation({}, 7, 'sync'), true);
  assert.equal(canStartRepositoryOperation({}, '7', 'remove'), true);
});

test('blocks repeated and conflicting operations for the same repository only', () => {
  const state = { syncingRepos: new Set(['7']), removingRepos: new Set(['9']) };
  assert.equal(canStartRepositoryOperation(state, 7, 'sync'), false);
  assert.equal(canStartRepositoryOperation(state, '7', 'remove'), false);
  assert.equal(canStartRepositoryOperation(state, 9, 'remove'), false);
  assert.equal(canStartRepositoryOperation(state, 8, 'sync'), true);
});

test('rejects unknown repository operation types', () => {
  assert.equal(canStartRepositoryOperation({}, 7, 'archive'), false);
});
