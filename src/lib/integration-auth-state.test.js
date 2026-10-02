import assert from 'node:assert/strict';
import test from 'node:test';
import { googleReauthorizationButtonState, integrationStatusTone, mercadoPagoAuthorizationButtonState } from './integration-auth-state.js';

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
