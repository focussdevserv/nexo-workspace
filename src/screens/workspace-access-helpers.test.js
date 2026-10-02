import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAuthEmail, prefillRecoveryEmail, readPasswordResetToken, readWorkspaceAccessMode, workspaceAccessModeUrl } from './workspace-access-helpers.js';

test('recovery pre-fills the email already entered on the login form', () => {
  assert.equal(prefillRecoveryEmail('  User@Example.com  '), 'User@Example.com');
  assert.equal(prefillRecoveryEmail(''), '');
  assert.equal(prefillRecoveryEmail(null), '');
});

test('auth requests normalize e-mail case and surrounding whitespace', () => {
  assert.equal(normalizeAuthEmail('  User@Example.com  '), 'user@example.com');
  assert.equal(normalizeAuthEmail(undefined), '');
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
  assert.equal(readWorkspaceAccessMode('#access=invalid'), 'login');
  assert.equal(workspaceAccessModeUrl('https://focusshub.example/app?tab=login#section=auth', 'reset-request'), 'https://focusshub.example/app?tab=login#section=auth&access=reset-request');
  assert.equal(workspaceAccessModeUrl('https://focusshub.example/app?invite=secret#reset=secret&section=auth', 'login'), 'https://focusshub.example/app#section=auth');
});
