import assert from 'node:assert/strict';
import test from 'node:test';
import { findTicketByActionKey } from './ticket-record-selection.js';

test('resolves ticket table actions by workspace record ID', () => {
  const tickets = [{ id: 'record-1', code: 'NX-1' }, { id: 'record-2', code: 'NX-2' }];
  assert.equal(findTicketByActionKey(tickets, 'record-2'), tickets[1]);
});

test('prefers the record ID when an older ticket shares a display code', () => {
  const tickets = [{ id: 'record-1', code: 'NX-1' }, { id: 'record-2', code: 'NX-1' }];
  assert.equal(findTicketByActionKey(tickets, 'record-2'), tickets[1]);
});

test('keeps compatibility with rows that provide only the visible ticket code', () => {
  const ticket = { code: 'NX-1' };
  assert.equal(findTicketByActionKey([ticket], 'NX-1'), ticket);
  assert.equal(findTicketByActionKey([ticket], 'missing'), undefined);
});
