import assert from 'node:assert/strict';
import test from 'node:test';
import { clientContactActions } from './client-contact-actions.js';

test('client profile actions only open email or WhatsApp when contact data is usable', () => {
  assert.deepEqual(clientContactActions('person@example.com', '(11) 98888-7777'), {
    emailHref: 'mailto:person@example.com',
    whatsappHref: 'https://wa.me/5511988887777',
  });
  assert.deepEqual(clientContactActions('', 'sem telefone'), { emailHref: '', whatsappHref: '' });
  assert.deepEqual(clientContactActions('bad email', '123'), { emailHref: '', whatsappHref: '' });
});

test('client profile contact links reject malformed and overlong values', () => {
  assert.equal(clientContactActions('x@localhost', '12345678').emailHref, '');
  assert.equal(clientContactActions('x@example.com', '12345678').whatsappHref, '');
  assert.equal(clientContactActions('x@example.com', '+44 20 7946 0958').whatsappHref, 'https://wa.me/442079460958');
  assert.equal(clientContactActions('x@example.com', '1'.repeat(16)).whatsappHref, '');
  assert.equal(clientContactActions('x'.repeat(250) + '@example.com', '5511999999999').emailHref, '');
});
