import { createHmac, timingSafeEqual } from 'node:crypto';

export function portalIdentifierMatches(client: Record<string, unknown>, identifier: string) {
  const value = identifier.trim();
  if (!value) return false;
  const email = String(client.email || '').trim().toLocaleLowerCase('pt-BR');
  const normalized = value.toLocaleLowerCase('pt-BR');
  if (email && normalized.includes('@') && normalized === email) return true;
  const digits = value.replace(/\D/g, '');
  if (!digits) return false;
  const normalizePhone = (value: unknown) => { const raw = String(value || '').replace(/\D/g, ''); return raw.startsWith('55') && [12, 13].includes(raw.length) ? raw.slice(2) : raw; };
  if ([client.phone].some((field) => normalizePhone(field) === normalizePhone(value))) return true;
  return [client.document, client.cpf, client.cnpj, client.companyDocument].some((field) => String(field || '').replace(/\D/g, '') === digits);
}

export function hashPortalLoginCode(challengeId: string, code: string, secret: string) {
  return createHmac('sha256', secret).update(`${challengeId}:${code}`).digest('hex');
}

export function portalLoginCodeMatches(challengeId: string, code: string, secret: string, expectedHash: string) {
  if (!/^\d{6}$/.test(code) || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = Buffer.from(hashPortalLoginCode(challengeId, code, secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function maskPortalEmail(value: string) {
  const [local, domain] = value.trim().split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, 1)}***@${domain}`;
}
