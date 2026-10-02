import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildMercadoPagoAuthorizationUrl, createPkcePair, mercadoPagoOAuthStateIsActive, parseMercadoPagoTokenSet } from '../src/integrations/mercadopago-oauth.js';

test('Mercado Pago authorization URL includes state, callback and S256 PKCE', () => {
  const { verifier, challenge } = createPkcePair();
  assert.equal(createHash('sha256').update(verifier).digest('base64url'), challenge);
  const url = new URL(buildMercadoPagoAuthorizationUrl({ clientId: 'app-id', redirectUri: 'https://app.test/api/integrations/mercadopago/callback', state: 'random-state', challenge }));
  assert.equal(url.origin, 'https://auth.mercadopago.com');
  assert.equal(url.searchParams.get('client_id'), 'app-id');
  assert.equal(url.searchParams.get('state'), 'random-state');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://app.test/api/integrations/mercadopago/callback');
});

test('token parsing requires account identity and preserves a rotated refresh token safely', () => {
  const existing = { accessToken: 'old-access', refreshToken: 'old-refresh', expiresAt: 1, accountId: '123', publicKey: 'public', liveMode: true };
  const parsed = parseMercadoPagoTokenSet({ access_token: 'new-access', expires_in: 3600, user_id: 123 }, existing);
  assert.equal(parsed?.accessToken, 'new-access');
  assert.equal(parsed?.refreshToken, 'old-refresh');
  assert.equal(parsed?.accountId, '123');
  assert.equal(parsed?.publicKey, 'public');
  assert.equal(parsed?.liveMode, true);
  assert.equal(parseMercadoPagoTokenSet({ access_token: 'bad', expires_in: 0, user_id: 123 }), null);
});

test('OAuth callback rejects a consumed state and rejects a callback after disconnecting its state record', () => {
  const { verifier } = createPkcePair();
  const verifierHash = createHash('sha256').update(verifier).digest('base64url');
  const valid = { callbackState: 'state-once', cookieState: 'state-once', verifier, expectedVerifierHash: verifierHash, recordVerifierHash: verifierHash, recordExpiresAt: Date.now() + 60_000, recordActive: true };
  assert.equal(mercadoPagoOAuthStateIsActive(valid), true);
  assert.equal(mercadoPagoOAuthStateIsActive({ ...valid, recordActive: false }), false);
  assert.equal(mercadoPagoOAuthStateIsActive({ ...valid, cookieState: undefined }), false);
});
