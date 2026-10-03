import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('persists the selected recurring dates and sends them with the chosen cycle to Mercado Pago', async () => {
  const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = server.indexOf("app.post('/api/billing/subscriptions'");
  const end = server.indexOf("app.patch('/api/billing/subscriptions/:id/status'", start);
  const route = server.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(route, /startAt: body\.startAt \? new Date\(body\.startAt\) : null/);
  assert.match(route, /endAt: body\.endAt \? new Date\(body\.endAt\) : null/);
  assert.match(route, /frequency: body\.frequencyInterval, frequency_type: body\.frequency/);
  assert.match(route, /start_date: body\.startAt/);
  assert.match(route, /end_date: body\.endAt/);

  const screen = await readFile(new URL('../../src/screens/PaymentScreens.jsx', import.meta.url), 'utf8');
  assert.match(screen, /\.\.\.subscriptionCyclePayload\(form\.frequency, form\.frequencyInterval\), \.\.\.buildSubscriptionSchedule\(form\.startDate, form\.endDate\)/);
  assert.match(screen, /value=\{subscriptionCycleChoice\(form\.frequency, form\.frequencyInterval\)\}/);
  assert.match(screen, /Personalizar frequ/);
  assert.match(screen, /type="number" required min="1" max="24" step="1"/);
  assert.match(screen, /Recorr\u00eancia at\u00e9 \u00b7 \{formatPaymentDate\(item\.endAt\)\}/);
});

test('adds subscription date columns through an incremental migration and keeps it journaled', async () => {
  const migration = await readFile(new URL('../drizzle/0012_billing_subscription_schedule.sql', import.meta.url), 'utf8');
  const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')) as { entries: Array<{ idx: number; tag: string }> };
  assert.match(migration, /ALTER TABLE billing_subscriptions[\s\S]*ADD COLUMN IF NOT EXISTS start_at timestamptz[\s\S]*ADD COLUMN IF NOT EXISTS end_at timestamptz/);
  assert.ok(journal.entries.some((entry) => entry.idx === 12 && entry.tag === '0012_billing_subscription_schedule'));
});
