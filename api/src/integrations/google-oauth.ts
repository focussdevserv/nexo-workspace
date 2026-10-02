const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

export function googleOAuthStateRecordIsActive(input: {
  callbackState?: string;
  cookieState?: string;
  expectedNonce?: string;
  recordNonce?: unknown;
  recordExpiresAt?: unknown;
  recordActive: boolean;
  now?: number;
}) {
  return input.recordActive
    && Boolean(input.callbackState)
    && input.callbackState === input.cookieState
    && Boolean(input.expectedNonce)
    && input.recordNonce === input.expectedNonce
    && Number(input.recordExpiresAt) > (input.now ?? Date.now());
}

export function buildGoogleAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
}) {
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.search = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: input.scopes.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state: input.state,
  }).toString();
  return url.toString();
}
