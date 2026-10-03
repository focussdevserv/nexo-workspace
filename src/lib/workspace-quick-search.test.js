import assert from 'node:assert/strict';
import test from 'node:test';
import { workspaceQuickSearchResults } from './workspace-quick-search.js';

const pages = ['Meu Dia', 'CRM', 'Leads', 'Pipeline', 'Clientes', 'Cobranças', 'Contatos'];

test('global quick search includes internal CRM screens and accent-insensitive matches', () => {
  assert.deepEqual(workspaceQuickSearchResults('contato', pages), ['Contatos']);
  assert.deepEqual(workspaceQuickSearchResults('cobrancas', pages), ['Cobranças']);
  assert.deepEqual(workspaceQuickSearchResults('l', pages).slice(0, 2), ['Leads', 'Pipeline']);
});

test('global quick search excludes inaccessible pages and deduplicates labels', () => {
  assert.deepEqual(workspaceQuickSearchResults('', ['CRM', 'Leads', 'Leads', 'Contatos'], (page) => page !== 'Contatos', 10), ['CRM', 'Leads']);
});

test('global quick search enforces result limit and returns no matches for empty access', () => {
  assert.deepEqual(workspaceQuickSearchResults('', pages, () => false), []);
  assert.deepEqual(workspaceQuickSearchResults('', pages, () => true, 2), ['Meu Dia', 'CRM']);
});
