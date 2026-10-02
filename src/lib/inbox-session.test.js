import assert from 'node:assert/strict';
import test from 'node:test';
import { preferredInboxSessionId } from './inbox-session.js';

test('prefers the active WAHA session linked to the selected conversation', () => {
  const sessions = [{ id: 'sales' }, { id: 'support' }];
  assert.equal(preferredInboxSessionId('support', sessions), 'support');
});

test('falls back to an active session when the conversation is linked to a paused session', () => {
  const sessions = [{ id: 'sales' }, { id: 'support' }];
  assert.equal(preferredInboxSessionId('paused-session', sessions), 'sales');
});

test('returns an empty selection when no WAHA session is active', () => {
  assert.equal(preferredInboxSessionId('sales', []), '');
});
