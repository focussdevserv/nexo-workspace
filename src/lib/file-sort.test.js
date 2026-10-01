import test from 'node:test';
import assert from 'node:assert/strict';
import { sortFilesByName, sortFilesByRecent } from './file-sort.js';

test('sorts recently changed files first and keeps unknown dates in their original order', () => {
  const files = [
    { id: 'old', name: 'Projeto', createdAt: '2026-01-10T12:00:00Z' },
    { id: 'unknown-a', name: 'Sem data A' },
    { id: 'new', name: 'Relatório', updatedAt: '2026-10-01T09:00:00Z' },
    { id: 'unknown-b', name: 'Sem data B' },
  ];
  assert.deepEqual(sortFilesByRecent(files).map((file) => file.id), ['new', 'old', 'unknown-a', 'unknown-b']);
  assert.deepEqual(files.map((file) => file.id), ['old', 'unknown-a', 'new', 'unknown-b']);
});

test('parses Brazilian date-only file dates in local calendar time', () => {
  const sameDay = [
    { id: 'older', name: 'Antigo', date: '30/09/2026' },
    { id: 'newer', name: 'Novo', date: '01/10/2026' },
  ];
  assert.deepEqual(sortFilesByRecent(sameDay).map((file) => file.id), ['newer', 'older']);
});

test('sorts file names alphabetically in Portuguese while preserving equal-name order', () => {
  const files = [{ id: 'z', name: 'zebra' }, { id: 'a', name: 'Árvore' }, { id: 'b', name: 'arvore' }];
  assert.deepEqual(sortFilesByName(files).map((file) => file.id), ['a', 'b', 'z']);
});
