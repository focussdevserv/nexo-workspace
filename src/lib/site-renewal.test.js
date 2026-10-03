import test from 'node:test';
import assert from 'node:assert/strict';
import { siteRenewalDaysUntil, summarizeSiteRenewals } from './site-renewal.js';

test('computes renewal days using calendar dates across daylight saving changes', () => {
  const today = new Date(2026, 9, 3, 18);
  assert.equal(siteRenewalDaysUntil('2026-10-02', today), -1);
  assert.equal(siteRenewalDaysUntil('2026-10-03', today), 0);
  assert.equal(siteRenewalDaysUntil('2026-11-02', today), 30);
});

test('accepts legacy Brazilian renewal dates and rejects invalid calendar dates', () => {
  const today = new Date(2026, 9, 3);
  assert.equal(siteRenewalDaysUntil('04/10/2026', today), 1);
  assert.equal(siteRenewalDaysUntil('31/02/2026', today), null);
  assert.equal(siteRenewalDaysUntil('', today), null);
});

test('summarizes overdue, due soon, upcoming and missing renewal dates', () => {
  const today = new Date(2026, 9, 3);
  assert.deepEqual(summarizeSiteRenewals([
    { renewalDate: '2026-10-02' },
    { renewalDate: '2026-11-02' },
    { renewalDate: '2026-11-04' },
    { renewal: '2026-12-01' },
    { renewalDate: '' },
  ], today), { overdue: 1, soon: 1, missing: 1, upcoming: 2 });
});
