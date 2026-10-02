import test from 'node:test';
import assert from 'node:assert/strict';
import { commercialServicePayload } from './commercial-service-payload.js';

test('service creation keeps the description and billing cadence entered in the form', () => {
  const payload = commercialServicePayload({
    common: { id: 7, name: 'Suporte', title: 'Suporte' },
    draft: { detail: 'Suporte', description: 'Atendimento e correções', value: '350', cadence: 'Mensal' },
    tone: 'green',
  });

  assert.deepEqual(payload, {
    id: 7,
    name: 'Suporte',
    title: 'Suporte',
    category: 'Suporte',
    description: 'Atendimento e correções',
    price: 'A partir de R$ 350',
    cadence: 'Mensal',
    color: 'green',
  });
});

test('service creation uses safe defaults when optional commercial fields are blank', () => {
  const payload = commercialServicePayload({ common: {}, draft: {}, tone: 'blue' });
  assert.equal(payload.category, 'Geral');
  assert.equal(payload.description, 'Serviço cadastrado pela equipe.');
  assert.equal(payload.price, 'A combinar');
  assert.equal(payload.cadence, 'Projeto fechado');
});
