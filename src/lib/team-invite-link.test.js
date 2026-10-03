import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveTeamInviteLink } from './team-invite-link.js';

test('keeps the usable invite link while editing or attempting a renewal', () => {
  const current = { url: 'https://app.example/#invite=old', recipient: 'person@example.com' };
  for (const type of ['draft-changed', 'renewal-started', 'request-failed']) {
    assert.equal(resolveTeamInviteLink(current, { type }), current);
  }
  assert.equal(resolveTeamInviteLink(current, { type: 'created', url: '', recipient: 'new@example.com' }), current);
});

test('replaces the displayed link only after the server returns a new invitation', () => {
  assert.deepEqual(resolveTeamInviteLink(
    { url: 'https://app.example/#invite=old', recipient: 'old@example.com' },
    { type: 'created', url: ' https://app.example/#invite=new ', recipient: ' NEW@example.com ' },
  ), { url: 'https://app.example/#invite=new', recipient: 'new@example.com' });
});
