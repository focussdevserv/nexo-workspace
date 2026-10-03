import assert from 'node:assert/strict';
import test from 'node:test';
import { ticketActivityAuthor } from './ticket-activity-author.js';

test('ticket activity uses the signed-in operator, not the assigned teammate', () => {
  assert.equal(ticketActivityAuthor({ name: '  Júlia Costa ' }), 'Júlia Costa');
});

test('ticket activity has a safe fallback when the profile is unavailable', () => {
  assert.equal(ticketActivityAuthor(null), 'Equipe');
  assert.equal(ticketActivityAuthor({ name: '   ' }, 'Suporte'), 'Suporte');
});
