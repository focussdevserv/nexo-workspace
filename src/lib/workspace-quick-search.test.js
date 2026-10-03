import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
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

test('global quick search is named, uses search semantics, and does not open the mobile keyboard automatically', async () => {
  const source = await readFile(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.match(source, /type="search" name="workspaceSearch" autoComplete="off" aria-label="Buscar em telas do Focusshub"/);
  assert.match(source, /if \(!searchOpen \|\| !window\.matchMedia\('\(min-width: 761px\)'\)\.matches\) return;/);
  assert.doesNotMatch(source, /<input ref=\{quickSearchInputRef\}[^>]*autoFocus/);
});

test('lead filters use pressed-button semantics instead of incomplete tab semantics', async () => {
  const source = await readFile(new URL('../App.jsx', import.meta.url), 'utf8');
  assert.match(source, /className="lead-filters" role="group" aria-label="Filtrar leads"/);
  assert.match(source, /type="button" aria-pressed=\{filter === item\}/);
  assert.doesNotMatch(source, /className="lead-filters" role="tablist"/);
});
