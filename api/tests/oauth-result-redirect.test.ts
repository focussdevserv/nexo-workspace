import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOAuthResultRedirectUrl } from '../src/integrations/oauth-result-redirect.js';

test('Google OAuth returns the owner to Integrations with a connected result', () => {
  const target = new URL(buildOAuthResultRedirectUrl('https://focusshub.example', 'google', 'connected'));
  assert.equal(target.pathname, '/app/integracoes');
  assert.equal(target.searchParams.get('google'), 'connected');
  assert.equal(target.searchParams.has('reason'), false);
});

test('Mercado Pago OAuth returns setup failures to Integrations with an actionable reason', () => {
  const target = new URL(buildOAuthResultRedirectUrl('https://focusshub.example', 'mercadopago', 'error', 'consent_denied'));
  assert.equal(target.pathname, '/app/integracoes');
  assert.equal(target.searchParams.get('mercadopago'), 'error');
  assert.equal(target.searchParams.get('reason'), 'consent_denied');
});
