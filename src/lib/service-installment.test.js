import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceServiceInstallment } from './service-installment.js';

test('advances only the expected installment and preserves other service charges', () => {
  const charges = [
    { serviceId: 'site', generatedInstallments: 1, installments: 4 },
    { serviceId: 'hosting', generatedInstallments: 0, installments: 12 },
  ];
  const next = advanceServiceInstallment(charges, 'site', 1);
  assert.deepEqual(next, [
    { serviceId: 'site', generatedInstallments: 2, installments: 4 },
    { serviceId: 'hosting', generatedInstallments: 0, installments: 12 },
  ]);
  assert.equal(charges[0].generatedInstallments, 1);
});

test('refuses a missing service or an installment already advanced elsewhere', () => {
  const charges = [{ serviceId: 'site', generatedInstallments: 2, installments: 4 }];
  assert.equal(advanceServiceInstallment(charges, 'site', 1), null);
  assert.equal(advanceServiceInstallment(charges, 'unknown', 0), null);
  assert.equal(advanceServiceInstallment(null, 'site', 0), null);
});
