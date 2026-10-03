import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildSubscriptionSchedule } from './subscription-schedule.js';

test('client profile recurring charges require and serialize an explicit São Paulo schedule', async () => {
  const source = await readFile(new URL('../screens/CommercialScreens.jsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ buildSubscriptionSchedule, minimumSubscriptionEndDate \} from "\.\.\/lib\/subscription-schedule\.js"/);
  assert.match(source, /recurringSchedule = buildSubscriptionSchedule\(financeDraft\.startAt, financeDraft\.endAt\)/);
  assert.match(source, /Data da primeira cobrança<input required=\{true\} type="date" min=\{dateAfterDays\(1\)\}/);
  assert.match(source, /frequencyInterval: recurringTerms\.frequencyInterval,[\s\S]*\.\.\.recurringSchedule/);

  assert.deepEqual(buildSubscriptionSchedule('2026-10-10', '2027-10-10'), {
    startAt: '2026-10-10T09:00:00-03:00',
    endAt: '2027-10-10T23:59:59-03:00',
  });
});
