import { createHash, randomBytes } from 'node:crypto';

export type MercadoPagoTokenSet = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  accountId: string;
  publicKey?: string;
  liveMode?: boolean;
};

export function createPkcePair() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function buildMercadoPagoAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
}) {
  const url = new URL('https://auth.mercadopago.com/authorization');
  url.search = new URLSearchParams({
    client_id: input.clientId,
    response_type: 'code',
    platform_id: 'mp',
    state: input.state,
    redirect_uri: input.redirectUri,
    code_challenge: input.challenge,
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

export function parseMercadoPagoTokenSet(payload: Record<string, unknown>, existing?: MercadoPagoTokenSet): MercadoPagoTokenSet | null {
  const accessToken = typeof payload.access_token === 'string' ? payload.access_token : '';
  const refreshToken = typeof payload.refresh_token === 'string' ? payload.refresh_token : existing?.refreshToken || '';
  const expiresIn = Number(payload.expires_in);
  const accountId = String(payload.user_id ?? existing?.accountId ?? '');
  if (!accessToken || !refreshToken || !Number.isFinite(expiresIn) || expiresIn <= 0 || !accountId) return null;
  return {
    accessToken,
    refreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    accountId,
    ...(typeof payload.public_key === 'string' ? { publicKey: payload.public_key } : existing?.publicKey ? { publicKey: existing.publicKey } : {}),
    ...(typeof payload.live_mode === 'boolean' ? { liveMode: payload.live_mode } : existing?.liveMode !== undefined ? { liveMode: existing.liveMode } : {}),
  };
}

export function mercadoPagoOAuthStateIsActive(input: {
  callbackState?: string;
  cookieState?: string;
  verifier?: string;
  expectedVerifierHash?: string;
  recordVerifierHash?: unknown;
  recordExpiresAt?: unknown;
  recordActive: boolean;
  now?: number;
}) {
  if (!input.recordActive || !input.callbackState || input.callbackState !== input.cookieState || !input.verifier || !input.expectedVerifierHash) return false;
  const verifierHash = createHash('sha256').update(input.verifier).digest('base64url');
  return verifierHash === input.expectedVerifierHash
    && input.recordVerifierHash === input.expectedVerifierHash
    && Number(input.recordExpiresAt) > (input.now ?? Date.now());
}
