import assert from 'node:assert/strict';
import test from 'node:test';
import { updatePaymentAddress, updatePaymentField } from './payment-form.js';

test('updates boleto address fields without replacing payment form state', () => {
  const form = {
    clientName: 'Cliente Exemplo',
    amount: '125.50',
    method: 'boleto',
    address: { zipCode: '01001000', streetName: 'Rua A', neighborhood: '', city: '', state: '' },
  };

  const withNeighborhood = updatePaymentAddress(form, 'neighborhood', 'Centro');
  const withState = updatePaymentAddress(withNeighborhood, 'state', 'SP');

  assert.deepEqual(withState, {
    ...form,
    address: { ...form.address, neighborhood: 'Centro', state: 'SP' },
  });
  assert.equal(form.address.neighborhood, '');
  assert.equal(form.address.state, '');
});

test('preserves sibling address fields across successive queued input updates', () => {
  const form = { clientName: 'Cliente', amount: '125.50', address: {} };
  const updates = [
    (current) => updatePaymentAddress(current, 'zipCode', '01001000'),
    (current) => updatePaymentAddress(current, 'streetName', 'Rua A'),
    (current) => updatePaymentAddress(current, 'streetNumber', '42'),
    (current) => updatePaymentAddress(current, 'neighborhood', 'Centro'),
    (current) => updatePaymentAddress(current, 'city', 'São Paulo'),
    (current) => updatePaymentAddress(current, 'state', 'SP'),
  ];

  const updated = updates.reduce((current, update) => update(current), form);

  assert.deepEqual(updated.address, {
    zipCode: '01001000', streetName: 'Rua A', streetNumber: '42',
    neighborhood: 'Centro', city: 'São Paulo', state: 'SP',
  });
  assert.equal(updated.clientName, 'Cliente');
  assert.equal(updated.amount, '125.50');
});

test('applies successive top-level input updates to the latest form state', () => {
  const form = { clientName: '', payerEmail: '', description: '', amount: '' };
  const updated = [
    (current) => updatePaymentField(current, 'clientName', 'Cliente'),
    (current) => updatePaymentField(current, 'payerEmail', 'cliente@example.com'),
    (current) => updatePaymentField(current, 'description', 'Serviço'),
    (current) => updatePaymentField(current, 'amount', '125.50'),
  ].reduce((current, update) => update(current), form);

  assert.deepEqual(updated, {
    clientName: 'Cliente', payerEmail: 'cliente@example.com',
    description: 'Serviço', amount: '125.50',
  });
});
