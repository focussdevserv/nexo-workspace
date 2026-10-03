import test from 'node:test';
import assert from 'node:assert/strict';
import { isCommercialDateWithinNextDays, parseCommercialDate } from './commercial-date.js';

test('parses supported renewal formats including labels and ISO timestamps', () => {
  assert.equal(parseCommercialDate('2026-10-31')?.toISOString(), '2026-10-31T00:00:00.000Z');
  assert.equal(parseCommercialDate('Renovação em 31/10/2026')?.toISOString(), '2026-10-31T00:00:00.000Z');
  assert.equal(parseCommercialDate('vigência até 7.11.2026')?.toISOString(), '2026-11-07T00:00:00.000Z');
  assert.equal(parseCommercialDate('2026-10-31T14:30:00.000Z')?.toISOString(), '2026-10-31T00:00:00.000Z');
});

test('rejects invalid calendar dates instead of silently normalizing them', () => {
  assert.equal(parseCommercialDate('Renovação 31/02/2026'), null);
  assert.equal(parseCommercialDate('A definir'), null);
});

test('renewal window includes today and day 30, excludes past and later dates', () => {
  const now = new Date(2026, 9, 2, 12);
  assert.equal(isCommercialDateWithinNextDays('02/10/2026', 30, now), true);
  assert.equal(isCommercialDateWithinNextDays('01/11/2026', 30, now), true);
  assert.equal(isCommercialDateWithinNextDays('02/11/2026', 30, now), false);
  assert.equal(isCommercialDateWithinNextDays('01/10/2026', 30, now), false);
});
