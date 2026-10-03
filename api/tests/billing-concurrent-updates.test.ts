import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('payment cancellation uses compare-and-swap so a paid webhook cannot be overwritten by a stale cancel response', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.post('/api/billing/orders/:id/cancel'");
  const end = source.indexOf("app.post('/api/billing/orders/:id/refresh'", start);
  const route = source.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(route, /eq\(billingOrders\.updatedAt, order\.updatedAt\)/);
  assert.match(route, /if \(!saved\) return reply\.code\(409\)/);
  assert.ok(route.indexOf('if (!saved)') < route.indexOf("action: 'canceled'"));
});

test('subscription status updates cannot overwrite a newer webhook snapshot', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.patch('/api/billing/subscriptions/:id/status'");
  const end = source.indexOf("app.post('/api/integrations/mercadopago/webhook'", start);
  const route = source.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(route, /eq\(billingSubscriptions\.updatedAt, subscription\.updatedAt\)/);
  assert.match(route, /if \(!saved\) return reply\.code\(409\)/);
  assert.ok(route.indexOf('if (!saved)') < route.indexOf("action: 'updated'"));
});

test('billing CAS timestamps have millisecond precision to match JavaScript Date snapshots', async () => {
  const schema = await readFile(new URL('../src/db/schema.ts', import.meta.url), 'utf8');
  const migration = await readFile(new URL('../drizzle/0014_far_white_tiger.sql', import.meta.url), 'utf8');
  const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8')) as { entries: Array<{ idx: number; tag: string }> };

  for (const table of ['billingOrders', 'billingSubscriptions']) {
    const tableStart = schema.indexOf(`export const ${table} = pgTable(`);
    const nextTableStart = schema.indexOf('\nexport const ', tableStart + 1);
    const tableEnd = nextTableStart < 0 ? schema.length : nextTableStart;
    assert.ok(tableStart >= 0 && tableEnd > tableStart);
    assert.match(schema.slice(tableStart, tableEnd), /updatedAt: timestamp\('updated_at', \{ withTimezone: true, precision: 3 \}\)/);
  }
  assert.match(migration, /ALTER TABLE "billing_orders" ALTER COLUMN "updated_at" SET DATA TYPE timestamp \(3\) with time zone/);
  assert.match(migration, /ALTER TABLE "billing_subscriptions" ALTER COLUMN "updated_at" SET DATA TYPE timestamp \(3\) with time zone/);
  assert.doesNotMatch(migration, /CREATE TABLE|ADD COLUMN/);
  assert.ok(journal.entries.some((entry) => entry.idx === 14 && entry.tag === '0014_far_white_tiger'));
});
