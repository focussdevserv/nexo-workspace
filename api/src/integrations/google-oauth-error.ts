export type GoogleOAuthFailure = {
  code: 'google_reauthorization_required' | 'google_oauth_client_misconfigured' | 'google_token_refresh_unavailable' | 'google_token_refresh_failed';
  statusCode: 409 | 502 | 503;
  message: string;
  requiresReauthorization: boolean;
};

/** Map Google's OAuth token endpoint response to safe, user-actionable status.
 * Only the stable `error` code is inspected; descriptions and bodies are never
 * returned or persisted because they may contain provider-specific details.
 */
export function classifyGoogleOAuthRefreshFailure(status: number, providerCode: unknown): GoogleOAuthFailure {
  const code = typeof providerCode === 'string' ? providerCode : '';
  if (code === 'invalid_grant') return {
    code: 'google_reauthorization_required', statusCode: 409, requiresReauthorization: true,
    message: 'A autorização salva do Google expirou ou foi revogada. Reautorize a conta Google para continuar usando Gmail e Calendar.',
  };
  if (code === 'invalid_client') return {
    code: 'google_oauth_client_misconfigured', statusCode: 503, requiresReauthorization: false,
    message: 'O Google recusou as credenciais OAuth do servidor (invalid_client). Revise GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no Coolify; a conta vinculada não foi alterada.',
  };
  return {
    code: 'google_token_refresh_failed', statusCode: status >= 500 ? 502 : 409, requiresReauthorization: false,
    message: status >= 500
      ? 'O Google está temporariamente indisponível para renovar a autorização. Tente novamente em instantes.'
      : 'O Google não conseguiu renovar a autorização. Atualize o status da integração e tente novamente; não foi possível identificar a causa com segurança.',
  };
}

export function googleOAuthRefreshNetworkFailure(): GoogleOAuthFailure {
  return {
    code: 'google_token_refresh_unavailable', statusCode: 502, requiresReauthorization: false,
    message: 'Não foi possível alcançar o serviço de autorização do Google para renovar o acesso. Tente novamente; se persistir, verifique a conectividade do servidor.',
  };
}
