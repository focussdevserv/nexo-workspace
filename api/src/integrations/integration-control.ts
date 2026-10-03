/** Integrations default to enabled until an owner explicitly pauses them. */
export function integrationControlAllowsUse(control: { enabled?: unknown } | null | undefined) {
  return control?.enabled !== false;
}

/** OAuth client credentials only enable consent; they do not mean a workspace account is linked. */
export function oauthProviderHasSavedAccount(provider: 'google' | 'mercadopago', account: { email?: unknown; accountId?: unknown; legacyAccount?: unknown } | null | undefined) {
  if (!account) return false;
  if (provider === 'google') return typeof account.email === 'string' && account.email.trim().length > 0;
  return (typeof account.accountId === 'string' && account.accountId.trim().length > 0) || account.legacyAccount === true;
}
