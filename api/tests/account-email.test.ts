import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAccountEmail } from '../src/auth/account-email.ts';

test('account e-mails are trimmed and canonicalized for invites and login', () => {
  assert.equal(normalizeAccountEmail('  Team.Member@Example.COM '), 'team.member@example.com');
});
