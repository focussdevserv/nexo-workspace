import assert from 'node:assert/strict';
import test from 'node:test';
import { ticketAssigneeFromOption, ticketAssigneeOptionValue } from './ticket-assignee.js';

const members = [
  { id: 'user-a', name: 'Ana Souza' },
  { id: 'user-b', name: 'Bruno Lima' },
];

test('ticket assignees resolve to the current active workspace member', () => {
  assert.equal(ticketAssigneeOptionValue({ owner: 'Ana Souza' }, members), 'user-a');
  assert.deepEqual(ticketAssigneeFromOption('user-b', members), { owner: 'Bruno Lima', ownerId: 'user-b' });
});

test('legacy ticket assignees remain visible until an operator changes them', () => {
  assert.equal(ticketAssigneeOptionValue({ owner: 'Former teammate' }, members), '__legacy__');
  assert.deepEqual(ticketAssigneeFromOption('__legacy__', members, 'Former teammate'), { owner: 'Former teammate', ownerId: '' });
});

test('clearing an assignee unassigns the ticket', () => {
  assert.deepEqual(ticketAssigneeFromOption('', members), { owner: '', ownerId: '' });
});
