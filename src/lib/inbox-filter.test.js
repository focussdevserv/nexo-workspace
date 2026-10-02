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

test('finds conversations by email address or phone number', () => {
  const contacts = [
    { id: 'mail', name: 'Ana', email: 'ana@example.com', phone: '+55 11 99999-0000' },
    { id: 'other', name: 'Bia', email: 'bia@example.com', phone: '+55 21 98888-0000' },
  ];

  assert.deepEqual(filterInboxConversations(contacts, 'ANA@EXAMPLE.COM').map(({ id }) => id), ['mail']);
  assert.deepEqual(filterInboxConversations(contacts, '21988880000').map(({ id }) => id), ['other']);
  assert.deepEqual(filterInboxConversations(contacts, '+55 21 98888-0000').map(({ id }) => id), ['other']);
});

test('recognizes resolved status variants consistently in both status filters', () => {
  const statusRows = [
    { id: 'english', status: 'resolved' },
    { id: 'localized', status: 'Resolvido' },
    { id: 'feminine', status: 'Resolvida' },
    { id: 'accented', status: 'RESOLVIDA' },
    { id: 'open', status: 'open' },
  ];

  assert.deepEqual(filterInboxConversations(statusRows, '', 'Abertas').map(({ id }) => id), ['open']);
  assert.deepEqual(filterInboxConversations(statusRows, '', 'Resolvidas').map(({ id }) => id), ['english', 'localized', 'feminine', 'accented']);
});
