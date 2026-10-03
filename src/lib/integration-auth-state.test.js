import assert from 'node:assert/strict';
import test from 'node:test';
import { canAuthorizeOAuthIntegrations, googleReauthorizationButtonState, integrationOAuthRedirectUri, integrationStatusLabel, integrationStatusTone, mercadoPagoAuthorizationButtonState, navigateToOAuthConsent } from './integration-auth-state.js';

test('only the workspace owner can start provider OAuth consent', () => {
  assert.equal(canAuthorizeOAuthIntegrations('owner'), true);
  for (const role of ['admin', 'member', 'viewer', '', undefined, null]) {
    assert.equal(canAuthorizeOAuthIntegrations(role), false);
  }
});

test('OAuth reauthorization in local demo explains the block without navigating externally', () => {
  const navigations = [];
  const notices = [];
  const started = navigateToOAuthConsent({
    localDemo: true,
    path: '/api/integrations/google/authorize',
    navigate: (path) => navigations.push(path),
    notify: (message) => notices.push(message),
  });
  assert.equal(started, false);
  assert.deepEqual(navigations, []);
  assert.match(notices[0], /demonstração local/);
});

test('OAuth consent navigates to the requested provider when not in local demo', () => {
  const navigations = [];
  const started = navigateToOAuthConsent({
    path: '/api/integrations/mercadopago/authorize',
    navigate: (path) => navigations.push(path),
  });
  assert.equal(started, true);
  assert.deepEqual(navigations, ['/api/integrations/mercadopago/authorize']);
});

test('offers OAuth setup when server client credentials are missing', () => {
  assert.deepEqual(mercadoPagoAuthorizationButtonState({ configured: false, oauthAvailable: false }), {
    disabled: false, action: 'configure', label: 'Configurar OAuth',
  });
});

test('starts OAuth when the server reports the client credentials are ready', () => {
  assert.deepEqual(mercadoPagoAuthorizationButtonState({ enabled: true, oauthAvailable: true }), {
    disabled: false, action: 'authorize', label: 'Autorizar conta',
  });
  assert.equal(mercadoPagoAuthorizationButtonState({ oauthAvailable: true, legacyAccount: true }).label, 'Vincular conta por OAuth');
  assert.equal(mercadoPagoAuthorizationButtonState({ oauthAvailable: true, accountId: 'seller-42' }).label, 'Conta seller-42 · reautorizar');
});

test('allows first-time Mercado Pago OAuth before seller tokens exist', () => {
  assert.deepEqual(mercadoPagoAuthorizationButtonState({ configured: false, enabled: false, oauthAvailable: true }), {
    disabled: false, action: 'authorize', label: 'Autorizar conta',
  });
});

test('does not start OAuth while status is loading or the provider is disabled', () => {
  assert.deepEqual(mercadoPagoAuthorizationButtonState({ oauthAvailable: true }, true), {
    disabled: true, action: null, label: 'Consultando…',
  });
  assert.deepEqual(mercadoPagoAuthorizationButtonState({ configured: true, enabled: false, oauthAvailable: true }), {
    disabled: true, action: null, label: 'Reative para autorizar',
  });
});

test('does not offer OAuth or a disconnected badge when integration status could not be loaded', () => {
  assert.deepEqual(mercadoPagoAuthorizationButtonState(undefined, false, true), {
    disabled: true, action: null, label: 'Status indisponível',
  });
  assert.equal(integrationStatusTone(undefined, { error: true }), 'pending');
  assert.equal(integrationStatusTone(undefined, { loading: true }), 'pending');
});

test('shows a configured but untested provider as pending, not connected', () => {
  assert.equal(integrationStatusTone({ configured: true, enabled: true, lastTestStatus: null }), 'pending');
  assert.equal(integrationStatusTone({ configured: true, enabled: true, lastTestStatus: 'connected' }), 'connected');
  assert.equal(integrationStatusTone({ configured: false, enabled: false }), 'disconnected');
});

test('does not present cached integration status as current while it is loading or unavailable', () => {
  const previouslyConnected = { configured: true, enabled: true, lastTestStatus: 'connected' };
  assert.equal(integrationStatusTone(previouslyConnected, { loading: true }), 'pending');
  assert.equal(integrationStatusTone(previouslyConnected, { error: true }), 'pending');
  assert.equal(integrationStatusLabel(previouslyConnected, { loading: true }), 'Consultando status…');
  assert.equal(integrationStatusLabel(previouslyConnected, { error: true }), 'Status indisponível');
  assert.equal(integrationStatusLabel(undefined), 'Status indisponível');
  assert.equal(integrationStatusLabel(previouslyConnected), null);
});

test('shows the API-configured Google OAuth callback instead of guessing the browser URL', () => {
  assert.equal(integrationOAuthRedirectUri(
    { oauthRedirectUri: 'https://api.focusshub.example/api/integrations/google/callback' },
    'https://preview.focusshub.example',
    'google',
  ), 'https://api.focusshub.example/api/integrations/google/callback');
  assert.equal(integrationOAuthRedirectUri({}, 'https://app.focusshub.example', 'google'),
    'https://app.focusshub.example/api/integrations/google/callback');
});

test('shows provider authentication and setup failures with an actionable non-success tone', () => {
  assert.equal(integrationStatusTone({ configured: true, enabled: true, lastTestStatus: 'error' }), 'error');
  assert.equal(integrationStatusTone({ configured: true, enabled: true, lastTestStatus: 'disconnected' }), 'disconnected');
  assert.equal(integrationStatusTone({ configured: true, enabled: true, lastTestStatus: 'setup_required' }), 'pending');
});

test('keeps Google reauthorization available after a failed or incomplete test', () => {
  for (const lastTestStatus of ['connected', 'setup_required', 'error']) {
    assert.deepEqual(googleReauthorizationButtonState({ accountEmail: 'user@example.com', enabled: true, lastTestStatus }), {
      visible: true, disabled: false, label: 'Reautorizar Google',
    });
  }
});

test('does not offer reauthorization without an account and respects paused or unavailable state', () => {
  assert.equal(googleReauthorizationButtonState({ configured: true }).visible, false);
  assert.deepEqual(googleReauthorizationButtonState({ accountEmail: 'user@example.com', enabled: false }), {
    visible: true, disabled: true, label: 'Reative para reautorizar',
  });
  assert.equal(googleReauthorizationButtonState({ accountEmail: 'user@example.com', enabled: true }, false, true).disabled, true);
});
