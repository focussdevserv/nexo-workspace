import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { withStableBillingPaidAt } from '../src/billing/paid-at.js';

test('first paid transition uses a trustworthy provider approval timestamp', () => {
  const details = withStableBillingPaidAt('pending', 'paid', {}, { date_approved: '2026-09-30T18:20:00-03:00' }, '2026-09-30T20:00:00Z', new Date('2026-10-01T12:00:00Z'));
  assert.equal(details.paidAt, '2026-09-30T21:20:00.000Z');
});

test('repeated paid refreshes keep the original paid date despite changing updatedAt', () => {
  const original = '2026-09-30T21:20:00.000Z';
  const details = withStableBillingPaidAt('paid', 'paid', { paidAt: original }, { status: 'approved' }, '2026-10-02T12:00:00Z', new Date('2026-10-02T12:30:00Z'));
  assert.equal(details.paidAt, original);
});

test('legacy paid records without paidAt get a deterministic date rather than the next refresh time', () => {
  const details = withStableBillingPaidAt('paid', 'paid', {}, { status: 'approved' }, '2026-09-30T21:20:00Z', new Date('2026-10-02T12:30:00Z'));
  assert.equal(details.paidAt, '2026-09-30T21:20:00.000Z');
});

test('new paid transitions without provider time use the first local transition time', () => {
  const details = withStableBillingPaidAt('pending', 'paid', {}, { status: 'approved' }, undefined, new Date('2026-10-02T12:30:00Z'));
  assert.equal(details.paidAt, '2026-10-02T12:30:00.000Z');
});

test('non-paid statuses do not acquire a paid timestamp', () => {
  const details = withStableBillingPaidAt('pending', 'cancelled', {}, { status: 'cancelled' }, undefined, new Date('2026-10-02T12:30:00Z'));
  assert.equal('paidAt' in details, false);
});

test('order creation, refresh and webhook persist the stable paid date', async () => {
  const source = await readFile(new URL('../src/server.ts', import.meta.url), 'utf8');
  const creation = source.slice(source.indexOf("app.post('/api/billing/orders'"), source.indexOf("app.post('/api/billing/orders/:id/cancel'"));
  const refresh = source.slice(source.indexOf("app.post('/api/billing/orders/:id/refresh'"), source.indexOf("app.post('/api/billing/subscriptions'"));
  const webhook = source.slice(source.indexOf("app.post('/api/integrations/mercadopago/webhook'"), source.indexOf("app.get('/api/clients'"));
  assert.match(creation, /withStableBillingPaidAt/);
  assert.match(refresh, /withStableBillingPaidAt/);
  assert.match(webhook, /withStableBillingPaidAt/);
  assert.match(webhook, /needsPaidDateBackfill/);
});
