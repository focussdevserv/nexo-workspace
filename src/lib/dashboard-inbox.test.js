import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardInboxConversations } from './dashboard-inbox.js';

test('Meu Dia shows the most recently active inbox conversations first', () => {
  const old = { id: 'old', name: 'Ana', updatedAt: '2026-10-01T12:00:00.000Z' };
  const newest = { id: 'newest', name: 'Bia', updatedAt: '2026-10-02T12:00:00.000Z' };
  const middle = { id: 'middle', name: 'Caio', updatedAt: '2026-10-02T10:00:00.000Z' };

  assert.deepEqual(dashboardInboxConversations([old, newest, middle], 2), [newest, middle]);
});

test('Meu Dia sorts clocked conversations before providerless records and keeps the latter stable', () => {
  const first = { id: 'first', name: 'Contato' };
  const second = { id: 'second', name: 'Outro contato', time: '09:30' };

  assert.deepEqual(dashboardInboxConversations([null, [], first, second]), [second, first]);
  assert.deepEqual(dashboardInboxConversations([null, [], first, { id: 'third' }]), [first, { id: 'third' }]);
  assert.deepEqual(dashboardInboxConversations([first], 0), []);
});

test('Meu Dia orders demo conversations by their HH:mm activity time', () => {
  const earlier = { id: 'earlier', time: '09:15' };
  const later = { id: 'later', time: '17:45' };

  assert.deepEqual(dashboardInboxConversations([earlier, later]), [later, earlier]);
});
