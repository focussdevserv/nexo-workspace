import test from 'node:test';
import assert from 'node:assert/strict';
import { safeLowercase } from './safe-lowercase.js';

test('normalizes optional display and query values without throwing', () => {
  assert.equal(safeLowercase(undefined), '');
  assert.equal(safeLowercase(null, 'Esta semana'), 'esta semana');
  assert.equal(safeLowercase('PLANILHA'), 'planilha');
  assert.equal(safeLowercase(12), '12');
});
