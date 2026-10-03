import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../screens/WorkspaceAccess.jsx', import.meta.url), 'utf8');

test('workspace login and recovery forms expose stable names and password-manager autocomplete', () => {
  assert.match(source, /id="workspace-email" name="email" type="email"[^>]*autoComplete="username"/);
  assert.match(source, /id="workspace-password" name="password" type="password" autoComplete="current-password"/);
  assert.match(source, /id="workspace-remember" name="rememberMe" type="checkbox"/);
  assert.match(source, /id="reset-email" name="email" type="email" autoComplete="email"/);
  assert.match(source, /id="reset-password" name="newPassword" type="password" autoComplete="new-password"/);
  assert.match(source, /id="reset-password-confirm" name="passwordConfirmation" type="password" autoComplete="new-password"/);
  assert.match(source, /id="invite-password" name="newPassword" type="password" autoComplete="new-password"/);
  assert.match(source, /id="invite-password-confirm" name="passwordConfirmation" type="password" autoComplete="new-password"/);
});
