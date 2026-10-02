import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesWorkSearch, normalizeWorkSearchText } from './work-search.js';

test('work search ignores Portuguese accents and letter case', () => {
  assert.equal(matchesWorkSearch(['Reunião', 'Aprovação do cliente'], 'reuniao'), true);
  assert.equal(matchesWorkSearch(['Reunião', 'Aprovação do cliente'], 'APROVACAO'), true);
  assert.equal(matchesWorkSearch(['Reunião', 'Aprovação do cliente'], 'projeto'), false);
});

test('empty and whitespace-only queries match every record', () => {
  assert.equal(matchesWorkSearch(['Agenda', 'Cliente'], ''), true);
  assert.equal(matchesWorkSearch(['Agenda', 'Cliente'], '  '), true);
  assert.equal(normalizeWorkSearchText('  AÇÃO  '), 'acao');
});
