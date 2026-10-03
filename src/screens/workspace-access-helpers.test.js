import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAuthEmail, passwordConfirmationMatches, prefillRecoveryEmail, readPasswordResetToken, readWorkspaceAccessMode, readWorkspaceInvite, shouldAutoEnterLocalDemo, workspaceAccessModeUrl } from './workspace-access-helpers.js';

test('recovery pre-fills the email already entered on the login form', () => {
  assert.equal(prefillRecoveryEmail('  User@Example.com  '), 'User@Example.com');
  assert.equal(prefillRecoveryEmail(''), '');
  assert.equal(prefillRecoveryEmail(null), '');
});

test('recognizes invitation tokens in query or fragment and surfaces empty invite links as invalid', () => {
  assert.deepEqual(readWorkspaceInvite('?invite=signed-token', ''), { token: 'signed-token', invalid: false });
  assert.deepEqual(readWorkspaceInvite('', '#invite=signed-token'), { token: 'signed-token', invalid: false });
  assert.deepEqual(readWorkspaceInvite('?invite=', ''), { token: '', invalid: true });
  assert.deepEqual(readWorkspaceInvite('', '#invite='), { token: '', invalid: true });
  assert.deepEqual(readWorkspaceInvite('', ''), { token: '', invalid: false });
});

test('explicit return to login suppresses local-demo autologin without disabling normal demo entry', () => {
  assert.equal(shouldAutoEnterLocalDemo({ active: true }), true);
  assert.equal(shouldAutoEnterLocalDemo({ requested: true }), true);
  assert.equal(shouldAutoEnterLocalDemo({ active: true, suppress: true }), false);
  assert.equal(shouldAutoEnterLocalDemo({ requested: true, active: true, suppress: true }), false);
});

test('auth requests normalize e-mail case and surrounding whitespace', () => {
  assert.equal(normalizeAuthEmail('  User@Example.com  '), 'user@example.com');
  assert.equal(normalizeAuthEmail(undefined), '');
});

test('password confirmation requires two matching strings without coercing missing values', () => {
  assert.equal(passwordConfirmationMatches('a-long-password', 'a-long-password'), true);
  assert.equal(passwordConfirmationMatches('a-long-password', 'different-password'), false);
  assert.equal(passwordConfirmationMatches('', ''), true);
  assert.equal(passwordConfirmationMatches('a-long-password', undefined), false);
});

test('reads a reset token from the email link fragment so it can survive a page refresh', () => {
  assert.equal(readPasswordResetToken('#reset=abc_DEF-123'), 'abc_DEF-123');
  assert.equal(readPasswordResetToken('#other=value&reset=token'), 'token');
  assert.equal(readPasswordResetToken('#reset='), '');
  assert.equal(readPasswordResetToken(undefined), '');
});

test('access mode follows browser history between login, recovery, and reset links', () => {
  assert.equal(readWorkspaceAccessMode(''), 'login');
  assert.equal(readWorkspaceAccessMode('#access=reset-request'), 'reset-request');
  assert.equal(readWorkspaceAccessMode('#reset=one-time-token'), 'reset-complete');
  assert.equal(readWorkspaceAccessMode('#reset='), 'reset-invalid');
  assert.equal(readWorkspaceAccessMode('#reset=&access=reset-request'), 'reset-invalid');
  assert.equal(readWorkspaceAccessMode('#access=invalid'), 'login');
  assert.equal(workspaceAccessModeUrl('https://focusshub.example/app?tab=login#section=auth', 'reset-request'), 'https://focusshub.example/app?tab=login#section=auth&access=reset-request');
  assert.equal(workspaceAccessModeUrl('https://focusshub.example/app?invite=secret#reset=secret&section=auth', 'login'), 'https://focusshub.example/app#section=auth');
});
