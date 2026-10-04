import test from 'node:test';
import assert from 'node:assert/strict';
import { publicLeadFormManagerState, publicLeadHasContact, publicLeadPayload } from './public-lead-form.js';

test('public form manager is visible and usable only for its owner outside demo mode', () => {
  assert.deepEqual(publicLeadFormManagerState({ isOwner: true, localDemo: false }), { visible: true, available: true });
  assert.deepEqual(publicLeadFormManagerState({ isOwner: true, localDemo: true }), { visible: true, available: false });
  assert.deepEqual(publicLeadFormManagerState({ isOwner: false, localDemo: false }), { visible: false, available: false });
});

test('public intake payload preserves explicit contact consent and opt-in marketing consent', () => {
  assert.deepEqual(publicLeadPayload({ name: '  Ana Lima ', email: ' ana@example.com ', phone: '', company: ' Acme ', message: ' Olá ', contactConsent: true, marketingConsent: false, website: '' }, 1234), {
    name: 'Ana Lima', email: 'ana@example.com', phone: '', company: 'Acme', message: 'Olá', contactConsent: true, marketingConsent: false, website: '', startedAt: 1234,
  });
});

test('public intake requires a usable contact channel and drops an invalid optional phone', () => {
  assert.equal(publicLeadHasContact({ phone: 'letters only' }), false);
  assert.equal(publicLeadHasContact({ phone: '1234567' }), false);
  assert.equal(publicLeadHasContact({ phone: '(11) 99999-1234' }), true);
  assert.equal(publicLeadHasContact({ email: 'ana@example.com', phone: 'invalid' }), true);
  assert.equal(publicLeadPayload({ email: 'ana@example.com', phone: 'invalid' }, 456).phone, '');
});

test('matches only valid public capture paths and slug lengths', async () => {
  const { publicLeadSlugFromPath } = await import('./public-lead-form.js');
  const slug = 'Abcdefghijklmnopqrstuvwx_123456';
  assert.equal(publicLeadSlugFromPath(`/captura/${slug}`), slug);
  assert.equal(publicLeadSlugFromPath('/captura/short'), null);
  assert.equal(publicLeadSlugFromPath(`/captura/${slug}/nested`), null);
});
