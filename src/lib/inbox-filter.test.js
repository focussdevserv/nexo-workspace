import test from 'node:test';
import assert from 'node:assert/strict';
import { filterInboxConversations } from './inbox-filter.js';

const rows = [
  { id: 'a', name: 'Ana', company: 'Acme', status: 'open', unread: 2 },
  { id: 'b', name: 'Bia', company: 'Beta', status: 'closed', unread: 0 },
  { id: 'c', name: 'Caio', company: 'Acme', status: 'closed', unread: 1 },
];

test('filters unread, open and resolved conversations independently', () => {
  assert.deepEqual(filterInboxConversations(rows, '', 'Nao lidas').map(({ id }) => id), ['a', 'c']);
  assert.deepEqual(filterInboxConversations(rows, '', 'Abertas').map(({ id }) => id), ['a']);
  assert.deepEqual(filterInboxConversations(rows, '', 'Resolvidas').map(({ id }) => id), ['b', 'c']);
});

test('searches the conversation name and company within the selected status', () => {
  assert.deepEqual(filterInboxConversations(rows, 'ACME', 'Resolvidas').map(({ id }) => id), ['c']);
});
