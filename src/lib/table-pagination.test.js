import test from 'node:test';
import assert from 'node:assert/strict';
import { clampTablePage, moveTablePage } from './table-pagination.js';

test('pagination navigation starts from the visible page when data shrinks', () => {
  assert.equal(clampTablePage(5, 2), 2);
  assert.equal(moveTablePage(5, 2, -1), 1);
  assert.equal(moveTablePage(5, 2, 1), 2);
});

test('pagination navigation stays within valid pages', () => {
  assert.equal(moveTablePage(1, 3, -1), 1);
  assert.equal(moveTablePage(3, 3, 1), 3);
  assert.equal(clampTablePage(0, 0), 1);
});
