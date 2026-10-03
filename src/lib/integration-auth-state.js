/** Decide whether Mercado Pago can start OAuth or must open server setup. */
export function mercadoPagoAuthorizationButtonState(state, loading = false, statusError = false) {
  if (loading) return { disabled: true, action: null, label: 'Consultando…' };
  if (statusError) return { disabled: true, action: null, label: 'Status indisponível' };
  // Mercado Pago reports `enabled: false` while no seller account is linked,
  // because `configured` represents saved account tokens. OAuth is precisely
  // the path that creates those tokens, so don't block first-time linking.
  if (state?.configured && state.enabled === false) return { disabled: true, action: null, label: 'Reative para autorizar' };
  if (state?.oauthAvailable) {
    return {
      disabled: false,
      action: 'authorize',
      label: state.accountId
        ? `Conta ${state.accountId} · reautorizar`
        : state.legacyAccount
          ? 'Vincular conta por OAuth'
          : 'Autorizar conta',
    };
  }
  return { disabled: false, action: 'configure', label: 'Configurar OAuth' };
}

/** Keep an authorized Google account recoverable after expired or revoked consent. */
export function googleReauthorizationButtonState(state, loading = false, statusError = false) {
  if (!state?.accountEmail) return { visible: false, disabled: true, label: 'Autorizar conta Google' };
  if (state.enabled === false) return { visible: true, disabled: true, label: 'Reative para reautorizar' };
  return {
    visible: true,
    disabled: loading || statusError,
    label: 'Reautorizar Google',
  };
}

export function integrationStatusTone(state, { loading = false, error = false } = {}) {
  // A cached result must not look authoritative while the latest status request
  // is still running or has failed. In particular, never keep a green badge
  // after the API could not confirm that the provider is still connected.
  if (loading || error) return 'pending';
  return state?.configured && state?.enabled && state.lastTestStatus === 'connected'
    ? 'connected'
    : state?.lastTestStatus === 'error' ? 'error'
      : !state?.configured || state?.enabled === false || state?.lastTestStatus === 'disconnected' ? 'disconnected'
        : 'pending';
}

/** Avoid presenting a cached account label as current during refresh or API failure. */
export function integrationStatusLabel(state, { loading = false, error = false } = {}) {
  if (loading) return 'Consultando status…';
  if (error || !state) return 'Status indisponível';
  return null;
}

/** Prefer the exact callback URL used by the API over a browser-origin guess. */
export function integrationOAuthRedirectUri(state, origin, provider) {
  if (state?.oauthRedirectUri) return state.oauthRedirectUri;
  return new URL(`/api/integrations/${provider}/callback`, origin).toString();
}

/** OAuth consent routes are restricted by the API to the workspace owner. */
export function canAuthorizeOAuthIntegrations(role) {
  return role === 'owner';
}

/** Provider credentials, connection state and health tests are workspace-owner controls. */
export function canManageIntegrationSettings(role) {
  return role === 'owner';
}

/** Keep demo workspaces from leaving the local app for real provider consent. */
export function navigateToOAuthConsent({ localDemo = false, navigate, notify, path, demoMessage = 'A autorização externa fica desativada na demonstração local.' }) {
  if (localDemo) {
    notify?.(demoMessage);
    return false;
  }
  if (typeof navigate !== 'function' || !path) return false;
  navigate(path);
  return true;
}
