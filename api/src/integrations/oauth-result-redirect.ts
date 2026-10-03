export type OAuthProvider = 'google' | 'mercadopago';
export type OAuthResult = 'connected' | 'error';

/** Return OAuth users to the integrations screen so its result notice is handled immediately. */
export function buildOAuthResultRedirectUrl(appOrigin: string, provider: OAuthProvider, result: OAuthResult, reason?: string) {
  const target = new URL('/app/integracoes', appOrigin);
  target.searchParams.set(provider, result);
  if (reason) target.searchParams.set('reason', reason);
  return target.toString();
}
