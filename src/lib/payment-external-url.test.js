import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { paymentExternalUrl } from './payment-external-url.js';

test('allows absolute HTTP(S) payment provider links and normalizes whitespace', () => {
  assert.equal(paymentExternalUrl(' https://www.mercadopago.com.br/checkout/123 '), 'https://www.mercadopago.com.br/checkout/123');
  assert.equal(paymentExternalUrl('http://localhost:3000/pay'), 'http://localhost:3000/pay');
});

test('rejects missing, malformed, credentialed, or non-web payment links', () => {
  for (const value of ['', null, undefined, '/checkout/123', 'javascript:alert(1)', 'data:text/html,hi', 'https://user:pass@example.test/pay', 'not a url']) {
    assert.equal(paymentExternalUrl(value), '', String(value));
  }
});

test('subscription results disclose a missing authorization URL and expose a path back to subscriptions', async () => {
  const source = await readFile(new URL('../screens/PaymentScreens.jsx', import.meta.url), 'utf8');
  assert.match(source, /resultIsSubscription && !subscriptionCheckoutUrl[\s\S]{0,400}role=\"alert\"/);
  assert.match(source, /resultIsSubscription && <button className=\"ns-secondary\"[\s\S]{0,200}detail: 'Assinaturas'/);
  assert.match(source, /href=\{subscriptionCheckoutUrl\}/);
});
