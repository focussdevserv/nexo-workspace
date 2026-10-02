import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyGoogleOAuthRefreshFailure, googleOAuthRefreshNetworkFailure } from '../src/integrations/google-oauth-error.ts';

test('identifies a revoked or expired refresh grant as a reauthorization requirement', () => {
  const result = classifyGoogleOAuthRefreshFailure(400, 'invalid_grant');
  assert.equal(result.code, 'google_reauthorization_required');
  assert.equal(result.statusCode, 409);
  assert.equal(result.requiresReauthorization, true);
  assert.match(result.message, /Reautorize a conta Google/);
});

test('keeps OAuth client configuration errors distinct from account reauthorization', () => {
  const result = classifyGoogleOAuthRefreshFailure(401, 'invalid_client');
  assert.equal(result.code, 'google_oauth_client_misconfigured');
  assert.equal(result.statusCode, 503);
  assert.equal(result.requiresReauthorization, false);
  assert.match(result.message, /GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET/);
});

test('uses safe generic messages for unknown provider codes and network failures', () => {
  const unknown = classifyGoogleOAuthRefreshFailure(400, 'sensitive provider detail');
  assert.equal(unknown.code, 'google_token_refresh_failed');
  assert.doesNotMatch(unknown.message, /sensitive provider detail/);
  assert.equal(googleOAuthRefreshNetworkFailure().code, 'google_token_refresh_unavailable');
});
