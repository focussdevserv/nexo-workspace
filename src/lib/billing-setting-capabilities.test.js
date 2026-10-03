import assert from 'node:assert/strict';
import test from 'node:test';
import { billingSettingCapabilities, isBillingSettingAvailable } from './billing-setting-capabilities.js';

test('due dates, accepted methods and new-subscription switch are active billing settings', () => {
  for (const field of ['defaultDueDays', 'pix', 'boleto', 'card', 'autoRenew']) {
    assert.equal(isBillingSettingAvailable(field), true, `${field} is wired to billing behavior`);
  }
});

test('late fee, interest and reminder offsets remain explicitly unavailable until applied', () => {
  for (const field of ['lateFee', 'interest', 'reminderDays']) {
    assert.equal(isBillingSettingAvailable(field), false, `${field} must not appear editable while ignored`);
  }
  assert.equal(isBillingSettingAvailable('unknown'), false);
  assert.deepEqual(Object.keys(billingSettingCapabilities).sort(), [
    'autoRenew', 'boleto', 'card', 'defaultDueDays', 'interest', 'lateFee', 'pix', 'reminderDays',
  ]);
});
