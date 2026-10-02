export const WORKSPACE_SESSION_SECONDS = 8 * 60 * 60;
export const PERSISTENT_WORKSPACE_SESSION_SECONDS = 30 * 24 * 60 * 60;
export const PERSISTENT_SESSION_RENEWAL_THRESHOLD_SECONDS = 15 * 24 * 60 * 60;

export function workspaceSessionPolicy(rememberMe = true) {
  const maxAge = rememberMe ? PERSISTENT_WORKSPACE_SESSION_SECONDS : WORKSPACE_SESSION_SECONDS;
  return { maxAge, expiresIn: `${maxAge}s` };
}

export function workspaceSessionCookieOptions(maxAge: number, secure: boolean) {
  return { path: '/', httpOnly: true as const, secure, sameSite: 'strict' as const, maxAge };
}

export function shouldRenewPersistentWorkspaceSession(rememberMe: unknown, expiration: unknown, nowSeconds = Math.floor(Date.now() / 1000)) {
  return rememberMe === true && typeof expiration === 'number' && Number.isFinite(expiration)
    && expiration - nowSeconds <= PERSISTENT_SESSION_RENEWAL_THRESHOLD_SECONDS;
}

export function workspaceSessionVersionIsCurrent(tokenVersion: unknown, currentVersion: number) {
  return (currentVersion === 0 && tokenVersion === undefined) || tokenVersion === currentVersion;
}
