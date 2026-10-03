import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClientPortalPaymentPreview } from './client-portal-payment-preview.js';

test('portal payment preview includes only the exact client-linked public fields and actions', () => {
  const result = buildClientPortalPaymentPreview([
    { id: 'due-later', workspaceClientId: 'client-a', createdAt: '2026-01-03', description: 'Cobrança futura', amount: 100, status: 'pending', paymentDetails: { pixCode: 'secret-code', ticketUrl: 'https://pay.example/boleto', accessToken: 'private' } },
    { id: 'paid', workspaceClientId: 'client-a', createdAt: '2026-01-02', description: 'Já paga', amount: 50, status: 'paid', paymentDetails: { pixCode: 'old-code', ticketUrl: 'https://pay.example/old-ticket' } },
    { id: 'other-client', workspaceClientId: 'client-b', createdAt: '2026-01-04', description: 'Não compartilhar', amount: 9, status: 'pending' },
  ], [
    { id: 'subscription', workspaceClientId: 'client-a', createdAt: '2026-01-05', description: 'Plano mensal', amount: 25, status: 'authorized', nextPaymentAt: '2026-02-01' },
  ], 'client-a');

  assert.deepEqual(result.map(({ id }) => id), ['subscription', 'due-later', 'paid']);
  assert.deepEqual(result[1], {
    id: 'due-later', description: 'Cobrança futura', amount: 100, status: 'pending', dueAt: undefined,
    hasPixAction: true, hasTicketAction: true,
  });
  assert.equal('paymentDetails' in result[1], false);
  assert.equal(result[2].hasTicketAction, false);
  assert.equal(result[2].hasPixAction, false);
  assert.equal(result[0].hasPixAction, false);
});

test('portal payment preview matches the public per-source and combined limits', () => {
  const date = (index) => new Date(Date.UTC(2026, 0, 1 + index)).toISOString();
  const orders = Array.from({ length: 102 }, (_, index) => ({ id: `order-${index}`, workspaceClientId: 'client-a', createdAt: date(index), dueAt: date(index) }));
  const subscriptions = Array.from({ length: 102 }, (_, index) => ({ id: `subscription-${index}`, workspaceClientId: 'client-a', createdAt: date(index), nextPaymentAt: date(index) }));

  const result = buildClientPortalPaymentPreview(orders, subscriptions, 'client-a');
  assert.equal(result.length, 100);
  assert.equal(result.some((item) => item.id === 'order-0'), false);
  assert.equal(result.some((item) => item.id === 'subscription-0'), false);
  assert.equal(result[0].dueAt, date(101));
});
