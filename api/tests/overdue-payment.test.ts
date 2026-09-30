import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildOverduePaymentEvent, overduePaymentRetryDelayMs } from '../src/integrations/overdue-payment.ts';

const now = new Date('2026-09-24T12:00:00.000Z');
const order = {
  id: 'd547b1a3-827f-4f4f-a9f8-becfc97f9215', clientId: '36f91c3a-9f9c-4e32-8dab-08c75037ba58',
  clientName: 'Cliente', description: 'Manutenção do site', amount: 350, status: 'pending', dueAt: new Date('2026-09-24T11:59:00.000Z'),
};

test('creates a minimal overdue event only for pending orders after expiration', () => {
  assert.deepEqual(buildOverduePaymentEvent(order, now), {
    id: order.id, billingOrderId: order.id, clientId: order.clientId, client: order.clientName,
    title: order.description, amount: 350, dueAt: '2026-09-24T11:59:00.000Z',
  });
  assert.equal(buildOverduePaymentEvent({ ...order, dueAt: new Date('2026-09-24T12:01:00.000Z') }, now), null);
  assert.equal(buildOverduePaymentEvent({ ...order, status: 'paid' }, now), null);
  assert.equal(buildOverduePaymentEvent({ ...order, dueAt: null }, now), null);
});

test('backs off retry attempts and caps delay at one hour', () => {
  assert.equal(overduePaymentRetryDelayMs(1), 30_000);
  assert.equal(overduePaymentRetryDelayMs(2), 60_000);
  assert.equal(overduePaymentRetryDelayMs(8), 60 * 60_000);
  assert.equal(overduePaymentRetryDelayMs(20), 60 * 60_000);
});

test('filters already-enqueued billing orders before limiting the scan batch', async () => {
  const server = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const scannerStart = server.indexOf('async function processOverdueBillingEvents');
  const queryStart = server.indexOf('const expiredOrders = await db.select', scannerStart);
  const queryEnd = server.indexOf('for (const order of expiredOrders)', queryStart);
  const query = server.slice(queryStart, queryEnd);

  assert.ok(scannerStart >= 0 && queryStart >= scannerStart && queryEnd > queryStart);
  assert.match(query, /notExists\(db\.select\(\{ id: billingOverdueEvents\.id \}\)/);
  assert.match(query, /billingOverdueEvents\.billingOrderId, billingOrders\.id/);
  assert.ok(query.indexOf('notExists') < query.indexOf('.limit(100)'));
});

test('adds an incremental outbox migration without recreating existing billing tables', async () => {
  const migration = await readFile(new URL('../drizzle/0004_billing_overdue_events.sql', import.meta.url), 'utf8');
  assert.match(migration, /CREATE TABLE "billing_overdue_events"/);
  assert.match(migration, /REFERENCES "billing_orders"\("id"\) ON DELETE CASCADE/);
  assert.match(migration, /billing_overdue_events_order_unique/);
  assert.doesNotMatch(migration, /CREATE TABLE "billing_orders"/);
  assert.doesNotMatch(migration, /CREATE TABLE "billing_subscriptions"/);
});
