import assert from 'node:assert/strict';
import test from 'node:test';
import { teamAccessStatus } from '../src/team/account-status.js';

const now = Date.parse('2026-10-03T12:00:00.000Z');

test('active account takes precedence over old invitation events', () => {
  assert.deepEqual(teamAccessStatus({ active: true, latestInviteActivity: { action: 'invited', payload: { inviteExpiresAt: '2026-10-01T00:00:00.000Z' } }, now }), {
    status: 'active', inviteExpiresAt: null,
  });
});

test('unaccepted invitation exposes its expiry and becomes expired at the boundary', () => {
  const activity = { action: 'invite_renewed', payload: { inviteExpiresAt: '2026-10-03T12:00:00.000Z' } };
  assert.deepEqual(teamAccessStatus({ active: false, latestInviteActivity: activity, now: now - 1 }), {
    status: 'invite_pending', inviteExpiresAt: '2026-10-03T12:00:00.000Z',
  });
  assert.deepEqual(teamAccessStatus({ active: false, latestInviteActivity: activity, now }), {
    status: 'invite_expired', inviteExpiresAt: '2026-10-03T12:00:00.000Z',
  });
});

test('suspension and unknown legacy inactive accounts are not presented as pending invites', () => {
  assert.deepEqual(teamAccessStatus({ active: false, latestInviteActivity: { action: 'deactivated' }, now }), {
    status: 'suspended', inviteExpiresAt: null,
  });
  assert.deepEqual(teamAccessStatus({ active: false, now }), { status: 'inactive', inviteExpiresAt: null });
});

test('invalid legacy expiry remains pending but does not show a false deadline', () => {
  assert.deepEqual(teamAccessStatus({ active: false, latestInviteActivity: { action: 'invited', payload: { inviteExpiresAt: 'bad' } }, now }), {
    status: 'invite_pending', inviteExpiresAt: null,
  });
});

test('older invitations without a stored deadline use the recorded invitation time', () => {
  assert.deepEqual(teamAccessStatus({ active: false, latestInviteActivity: { action: 'invited', createdAt: '2026-10-01T12:00:00.000Z' }, now }), {
    status: 'invite_expired', inviteExpiresAt: '2026-10-03T12:00:00.000Z',
  });
});
