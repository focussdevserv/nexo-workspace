import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPortalLoginCode, maskPortalEmail, portalIdentifierMatches, portalLoginCodeMatches } from '../src/integrations/client-portal-auth.ts';

test('matches portal sign-in by email, phone, CPF or CNPJ', () => {
  const client = { email: 'cliente@exemplo.com', phone: '+55 (11) 98888-7777', cpf: '123.456.789-00', cnpj: '12.345.678/0001-90' };
  assert.equal(portalIdentifierMatches(client, 'CLIENTE@EXEMPLO.COM'), true);
  assert.equal(portalIdentifierMatches(client, '11988887777'), true);
  assert.equal(portalIdentifierMatches(client, '12345678900'), true);
  assert.equal(portalIdentifierMatches(client, '12.345.678/0001-90'), true);
  assert.equal(portalIdentifierMatches(client, 'invalido@exemplo.com'), false);
});

test('uses an HMAC and rejects malformed or incorrect one-time codes', () => {
  const hash = hashPortalLoginCode('challenge-id', '381204', 'a-secret-that-is-long-enough-for-hmac');
  assert.equal(portalLoginCodeMatches('challenge-id', '381204', 'a-secret-that-is-long-enough-for-hmac', hash), true);
  assert.equal(portalLoginCodeMatches('challenge-id', '381205', 'a-secret-that-is-long-enough-for-hmac', hash), false);
  assert.equal(portalLoginCodeMatches('challenge-id', '38x204', 'a-secret-that-is-long-enough-for-hmac', hash), false);
});

test('masks the email address before showing where a code was sent', () => {
  assert.equal(maskPortalEmail('cliente@exemplo.com'), 'c***@exemplo.com');
});
