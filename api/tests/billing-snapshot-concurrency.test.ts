import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('manual billing refresh uses optimistic concurrency and returns the newest stored snapshot', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.post('/api/billing/orders/:id/refresh'");
  const end = source.indexOf("app.get('/api/billing/subscriptions'", start);
  const route = source.slice(start, end);

  assert.ok(start >= 0 && end > start);
  assert.match(route, /eq\(billingOrders\.id, order\.id\), eq\(billingOrders\.updatedAt, order\.updatedAt\)/);
  assert.match(route, /const latest = saved \?\? \(await db\.select\(\)\.from\(billingOrders\)/);
  assert.match(route, /changed: Boolean\(saved\) && changed/);
  assert.match(route, /if \(saved && changed\)/);
});

test('Mercado Pago webhook does not overwrite an order changed while the provider snapshot was loading', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const start = source.indexOf("app.post('/api/integrations/mercadopago/webhook'");
  const end = source.indexOf("app.post('/api/integrations/", start + 1);
  const route = source.slice(start, end > start ? end : undefined);

  assert.ok(start >= 0);
  assert.match(route, /eq\(billingOrders\.id, local\.id\), eq\(billingOrders\.updatedAt, local\.updatedAt\)/);
  assert.match(route, /if \(saved && !duplicateSnapshot\)/);
});
