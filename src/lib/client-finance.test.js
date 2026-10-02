import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClientFinanceHistory, clientFinanceDateKey, clientFinanceDueDateLabel, clientFinanceEditPatch, clientFinanceFailedResources, clientFinanceFilterCounts, clientFinanceFilterForPage, clientFinanceLegacyClientValue, clientFinanceOpenBillingCount, isClientFinanceCancelled, isClientFinanceSettled, manualFinanceSettlementPatch, normalizeClientSubscriptionTerms, prepareClientContractTrackingPatch, prepareClientServiceChargeUpdate } from './client-finance.js';
import { belongsToClient } from '../data/client-link.js';

test('client finance shortcuts map to an in-profile filter', () => {
  assert.equal(clientFinanceFilterForPage('Cobranças'), 'billing');
  assert.equal(clientFinanceFilterForPage('Contratos'), 'contracts');
  assert.equal(clientFinanceFilterForPage('Assinaturas'), 'subscriptions');
  assert.equal(clientFinanceFilterForPage('Receitas'), 'revenues');
  assert.equal(clientFinanceFilterForPage('Despesas'), 'expenses');
  assert.equal(clientFinanceFilterForPage('Financeiro'), 'all');
});

test('client profile shows billing deadlines in the workspace timezone', () => {
  assert.equal(clientFinanceDueDateLabel('2026-10-04T02:59:59.000Z'), '03/10/2026');
  assert.equal(clientFinanceDueDateLabel('invalid'), '');
});

test('finance failure state is scoped to the active client-profile filter', () => {
  const errors = { contracts: 'forbidden', billing: 'offline', settings: 'offline' };
  assert.deepEqual(clientFinanceFailedResources('contracts', errors), ['contracts']);
  assert.deepEqual(clientFinanceFailedResources('billing', errors), ['billing']);
  assert.deepEqual(clientFinanceFailedResources('revenues', errors), []);
  assert.deepEqual(clientFinanceFailedResources('all', errors), ['billing', 'contracts']);
});

test('legacy client expenses link by client name, never by vendor counterparty', () => {
  const client = { id: 'client-1', name: 'Aurora Café' };
  const expense = { counterparty: 'CloudHost', client: 'Aurora Café' };
  const unrelatedVendorExpense = { counterparty: 'Aurora Café' };
  assert.equal(belongsToClient(expense, client, clientFinanceLegacyClientValue('expenses', expense)), true);
  assert.equal(belongsToClient(unrelatedVendorExpense, client, clientFinanceLegacyClientValue('expenses', unrelatedVendorExpense)), false);
});

test('contract count is distinct and excluded from billing count', () => {
  const counts = clientFinanceFilterCounts({
    contracts: [{ id: 'contract-1' }, { id: 'contract-2' }],
    billing: [{ id: 'bill-1' }],
    plannedCharges: [{ billingMode: 'single' }, { billingMode: 'recurring' }],
  });
  assert.equal(counts.contracts, 2);
  assert.equal(counts.billing, 2);
  assert.equal(counts.subscriptions, 1);
  assert.equal(counts.all, 5);
});

test('planned service-charge edits preserve installment progress and update only the selected row', () => {
  const charges = [
    { serviceId: 'site', service: 'Site', billingMode: 'installments', amount: 900, installments: 3, generatedInstallments: 1 },
    { serviceId: 'support', service: 'Suporte', billingMode: 'recurring', amount: 300, frequency: 'months:1' },
  ];
  const result = prepareClientServiceChargeUpdate(charges, 0, {
    service: 'Site institucional', billingMode: 'installments', amount: '1200,50', installments: '4',
  });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.charges[0], { ...charges[0], service: 'Site institucional', amount: 1200.5, installments: 4 });
  assert.equal(result.charges[1], charges[1]);
});

test('planned charge edits reject invalid provider terms and do not rewrite issued installments', () => {
  const charge = { serviceId: 's1', service: 'Site', billingMode: 'installments', amount: 900, installments: 4, generatedInstallments: 3 };
  assert.match(prepareClientServiceChargeUpdate([charge], 0, { service: 'Site', billingMode: 'installments', amount: 950, installments: 1 }).error, /2 a 24/);
  assert.match(prepareClientServiceChargeUpdate([charge], 0, { service: 'Site', billingMode: 'installments', amount: 950, installments: 2 }).error, /parcelas emitidas/);
  assert.equal(charge.installments, 4);
});

test('contract tracking saves operational metadata without touching signature or legal text fields', () => {
  const result = prepareClientContractTrackingPatch({ renewal: '31/12/2027', internalNote: 'Revisar reajuste em novembro.' });
  assert.deepEqual(result.patch, { renewal: '31/12/2027', internalNote: 'Revisar reajuste em novembro.' });
  assert.equal('status' in result.patch, false);
  assert.equal('documentText' in result.patch, false);
  assert.match(prepareClientContractTrackingPatch({ renewal: 'x'.repeat(121) }).error, /120 caracteres/);
});

test('manual finance recognizes localized and provider status variants', () => {
  assert.equal(isClientFinanceSettled({ status: 'Recebida' }), true);
  assert.equal(isClientFinanceSettled({ status: 'settled' }), true);
  assert.equal(isClientFinanceCancelled({ status: 'Cancelada' }), true);
  assert.equal(isClientFinanceCancelled({ status: 'refunded' }), true);
  assert.equal(isClientFinanceSettled({ status: 'Pendente' }), false);
});

test('client profile open billing count excludes provider and localized settled or canceled states', () => {
  assert.equal(clientFinanceOpenBillingCount([
    { status: 'pending' },
    { status: 'overdue' },
    { status: 'processing' },
    { status: 'paid' },
    { status: 'Paga' },
    { status: 'cancelled' },
    { status: 'canceled' },
    { status: 'Cancelada' },
    { status: 'failed' },
    { status: 'rejected' },
    { status: 'expired' },
    { status: 'authorized' },
  ]), 3);
});

test('manual settlement uses realized timestamp and cannot settle closed records', () => {
  const now = new Date('2026-10-02T12:00:00.000Z');
  assert.deepEqual(manualFinanceSettlementPatch({ status: 'Pendente', resource: 'expenses' }, now), {
    status: 'Paga', settledAt: now.toISOString(), paidAt: now.toISOString(),
  });
  assert.equal(manualFinanceSettlementPatch({ status: 'Recebida' }, now), null);
  assert.equal(manualFinanceSettlementPatch({ status: 'Cancelada' }, now), null);
});

test('editing a pending client finance record does not silently mark it paid', () => {
  const record = { id: 'r1', status: 'Pendente', resource: 'revenues' };
  const now = new Date('2026-10-02T12:00:00.000Z');
  const ordinaryEdit = clientFinanceEditPatch(record, 'revenues', {
    description: 'Consultoria', amount: '250', date: '2026-10-02', status: 'Pendente',
  }, now);
  assert.deepEqual(ordinaryEdit, {
    description: 'Consultoria', amount: 250, date: '2026-10-02', status: 'Pendente',
  });
  assert.equal('settledAt' in ordinaryEdit, false);

  const explicitSettlement = clientFinanceEditPatch(record, 'revenues', {
    description: 'Consultoria', amount: '250', date: '2026-10-02', status: 'Recebida',
  }, now);
  assert.equal(explicitSettlement.status, 'Recebida');
  assert.equal(explicitSettlement.settledAt, now.toISOString());
  assert.equal(explicitSettlement.paidAt, now.toISOString());
});

test('editing an already settled client finance record preserves its original settlement timestamp', () => {
  const originalSettlement = '2026-08-15T09:30:00.000Z';
  const record = { id: 'r2', status: 'Recebida', settledAt: originalSettlement, paidAt: originalSettlement, resource: 'revenues' };
  const patch = clientFinanceEditPatch(record, 'revenues', {
    description: 'Consultoria atualizada', amount: '275', date: '2026-08-15', status: 'Recebida',
  }, new Date('2026-10-02T12:00:00.000Z'));

  assert.equal(patch.description, 'Consultoria atualizada');
  assert.equal('settledAt' in patch, false);
  assert.equal('paidAt' in patch, false);
});

test('client recurring billing preserves weekly and custom intervals', () => {
  assert.deepEqual(normalizeClientSubscriptionTerms('days', '7'), { frequency: 'days', frequencyInterval: 7 });
  assert.deepEqual(normalizeClientSubscriptionTerms('days', '3'), { frequency: 'days', frequencyInterval: 3 });
  assert.deepEqual(normalizeClientSubscriptionTerms('months', '2'), { frequency: 'months', frequencyInterval: 2 });
  assert.match(normalizeClientSubscriptionTerms('weeks', 1).error, /dias ou meses/);
  assert.match(normalizeClientSubscriptionTerms('days', 0).error, /1 a 24/);
  assert.match(normalizeClientSubscriptionTerms('months', 1.5).error, /1 a 24/);
});

test('client finance date inputs use the local calendar date instead of UTC', () => {
  assert.equal(clientFinanceDateKey(new Date(2026, 9, 2, 0, 30)), '2026-10-02');
  assert.equal(clientFinanceDateKey(new Date(2026, 9, 1, 23, 30)), '2026-10-01');
});

test('client financial history includes all four sources and sorts newest first', () => {
  const rows = buildClientFinanceHistory({
    billing: [{ id: 'b', createdAt: '2026-10-01T10:00:00Z' }],
    subscriptions: [{ id: 's', updatedAt: '2026-10-02T10:00:00Z' }],
    revenues: [{ id: 'r', settledAt: '2026-10-02T12:00:00Z' }],
    expenses: [{ id: 'e', date: '2026-09-30' }],
  });
  assert.deepEqual(rows.map(({ id }) => id), ['r', 's', 'b', 'e']);
  assert.deepEqual(rows.map(({ kind }) => kind), ['Receita', 'Assinatura', 'Cobrança', 'Despesa']);
});
