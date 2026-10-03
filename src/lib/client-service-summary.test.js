import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeClientServices } from './client-service-summary.js';

const plainMoney = (value) => value.replace(/\u00a0/g, ' ');

test('shows client specific recurring amount and cadence instead of catalog defaults', () => {
  const [row] = summarizeClientServices({
    services: ['Manuten\u00e7\u00e3o'],
    serviceCharges: [{ service: 'Manuten\u00e7\u00e3o', billingMode: 'recurring', amount: 350, frequency: 'months:1' }],
  });
  assert.equal(row.key, 'Manuten\u00e7\u00e3o-0');
  assert.equal(plainMoney(row.amount), 'R$ 350,00');
  assert.equal(row.cadence, 'Recorr\u00eancia Mensal');
  assert.equal(row.amountToCharge, 350);
  assert.equal(row.billingMode, 'recurring');
});

test('shows one time, installment, and not yet priced service terms', () => {
  const rows = summarizeClientServices({ serviceCharges: [
    { service: 'Site', billingMode: 'single', amount: 2400 },
    { serviceId: 'service-1', service: 'Identidade', billingMode: 'installments', amount: 100, installments: 3 },
    { service: 'Suporte', billingMode: 'none' },
  ] });
  assert.deepEqual(rows.map(({ name, amount, cadence }) => ({ name, amount: plainMoney(amount), cadence })), [
    { name: 'Site', amount: 'R$ 2.400,00', cadence: 'Cobran\u00e7a \u00fanica' },
    { name: 'Identidade', amount: 'R$ 100,00', cadence: '3 parcelas \u00b7 pr\u00f3xima 1/3' },
    { name: 'Suporte', amount: 'A definir', cadence: 'Pre\u00e7o a definir' },
  ]);
  assert.equal(rows[1].amountToCharge, 33.34);
  assert.equal(rows[1].installmentCount, 3);
  assert.equal(rows[1].installmentIndex, 0);
});

test('keeps legacy services without duplicate rows beside charge records', () => {
  assert.deepEqual(summarizeClientServices({ services: ['Site', 'SEO'], serviceCharges: [{ service: 'Site', billingMode: 'single', amount: 1000 }] }).map((row) => row.name), ['Site', 'SEO']);
});

test('legacy installment services use their record id as a stable billing-plan id', () => {
  const [service] = summarizeClientServices({ serviceCharges: [{ id: 'legacy-service', service: 'Support', billingMode: 'installments', amount: 200, installments: 2 }] });
  assert.equal(service.serviceId, 'legacy-service');
});
