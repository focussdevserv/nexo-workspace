import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { reconcileTeamInviteLink, resolveTeamInviteLink } from './team-invite-link.js';

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

test('hides a displayed link when its invitation is accepted, expired, or revoked', () => {
  const current = { url: 'https://app.example/#invite=old', recipient: 'person@example.com' };
  for (const account of [
    { email: 'PERSON@example.com', active: true, accessStatus: 'active' },
    { email: 'person@example.com', active: false, accessStatus: 'invite_expired' },
    { email: 'person@example.com', active: false, accessStatus: 'suspended' },
  ]) assert.deepEqual(reconcileTeamInviteLink(current, [account]), { url: '', recipient: '' });
});

test('keeps a usable invite link while pending and when refresh does not identify its recipient', () => {
  const current = { url: 'https://app.example/#invite=old', recipient: 'person@example.com' };
  assert.equal(reconcileTeamInviteLink(current, [{ email: 'person@example.com', active: false, accessStatus: 'invite_pending' }]), current);
  assert.equal(reconcileTeamInviteLink(current, [{ email: 'other@example.com', active: true, accessStatus: 'active' }]), current);
  assert.equal(reconcileTeamInviteLink(current, null), current);
});

test('team access UI exposes revoke for a pending invite and uses the account deactivation endpoint', () => {
  const source = readFileSync(fileURLToPath(new URL('../screens/TeamScreen.jsx', import.meta.url)), 'utf8');
  assert.match(source, /Revogar convite de '\s*\+ account\.name/);
  assert.match(source, /const revokeInvite = account\.accessStatus === 'invite_pending'/);
  assert.match(source, /\/api\/team\/users\/\$\{encodeURIComponent\(account\.id\)\}\/deactivate/);
  assert.match(source, /reconcileTeamInviteLink\(current, nextAccounts\)/);
});
