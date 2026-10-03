import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { advanceClientInstallmentProgress, buildClientFinanceHistory, clientBillingRecordState, clientFinanceDateKey, clientFinanceDraftForCreate, clientFinanceDueDateLabel, clientFinanceEditPatch, clientFinanceFailedResources, clientFinanceFilterCounts, clientFinanceFilterForPage, clientFinanceLegacyClientValue, clientFinanceOpenBillingCount, clientFinanceResourceLabels, clientFinanceScheduleForCreate, isClientFinanceCancelled, isClientFinanceSettled, manualFinanceSettlementPatch, mergeClientFinanceRecordUpdate, normalizeClientSubscriptionTerms, prepareClientContractTrackingPatch, prepareClientServiceChargeUpdate, resolveClientInstallmentRequest, safeClientFinanceExternalHref } from './client-finance.js';
import { belongsToClient } from '../data/client-link.js';

test('client finance shortcuts map to an in-profile filter', () => {
  assert.equal(clientFinanceFilterForPage('Cobranças'), 'billing');
  assert.equal(clientFinanceFilterForPage('Contratos'), 'contracts');
  assert.equal(clientFinanceFilterForPage('Assinaturas'), 'subscriptions');
  assert.equal(clientFinanceFilterForPage('Receitas'), 'revenues');
  assert.equal(clientFinanceFilterForPage('Despesas'), 'expenses');
  assert.equal(clientFinanceFilterForPage('Financeiro'), 'all');
});

test('a new client subscription does not inherit the prior subscription schedule', () => {
  assert.deepEqual(clientFinanceScheduleForCreate({}, '2026-10-04'), {
    startAt: '2026-10-04', endAt: '',
  });
  assert.deepEqual(clientFinanceScheduleForCreate({ startAt: '2026-11-10', endAt: '2027-01-10' }, '2026-10-04'), {
    startAt: '2026-11-10', endAt: '2027-01-10',
  });
});

test('new in-profile finance actions clear stale client, amount, description and installment context', () => {
  const currentDraft = {
    kind: 'recurring', description: 'Old service', amount: '1450', payerEmail: 'old@example.test',
    method: 'boleto', dueDate: '2026-12-01', frequency: 'days', frequencyInterval: '14',
    startAt: '2026-12-01', endAt: '2027-12-01', installmentServiceId: 'old-service', installmentIndex: 2,
  };
  const next = clientFinanceDraftForCreate({
    currentDraft, page: 'Receitas', context: { clientEmail: 'client@example.test' },
    client: { email: 'client@example.test' }, defaultDueDate: '2026-10-10', defaultStartAt: '2026-10-04',
  });

  assert.equal(next.kind, 'revenue');
  assert.equal(next.description, '');
  assert.equal(next.amount, '');
  assert.equal(next.payerEmail, 'client@example.test');
  assert.equal(next.dueDate, '2026-10-10');
  assert.equal(next.frequency, 'months');
  assert.equal(next.frequencyInterval, '1');
  assert.equal(next.startAt, '2026-10-04');
  assert.equal(next.endAt, '');
  assert.equal(next.installmentServiceId, '');
  assert.equal(next.installmentIndex, null);
  assert.equal(next.method, 'boleto');
});

test('prefilled zero amounts remain explicit instead of inheriting an earlier value', () => {
  const next = clientFinanceDraftForCreate({
    currentDraft: { amount: '900' }, page: 'Cobranças', context: { amount: 0 },
    client: {}, defaultDueDate: '2026-10-10', defaultStartAt: '2026-10-04',
  });
  assert.equal(next.amount, '0');
});

test('every new client finance action starts with a fresh recurring schedule', async () => {
  const source = await readFile(new URL('../screens/CommercialScreens.jsx', import.meta.url), 'utf8');
  const openTab = source.slice(source.indexOf('const openTab ='), source.indexOf('const saveClientFinance ='));
  assert.match(openTab, /clientFinanceDraftForCreate\(/);
});

test('client profile shows billing deadlines in the workspace timezone', () => {
  assert.equal(clientFinanceDueDateLabel('2026-10-04T02:59:59.000Z'), '03/10/2026');
  assert.equal(clientFinanceDueDateLabel('invalid'), '');
});

test('client profile preserves a date-only billing deadline as its selected calendar day', () => {
  assert.equal(clientFinanceDueDateLabel('2026-10-03'), '03/10/2026');
  assert.equal(clientFinanceDueDateLabel('2026-02-30'), '');
  assert.equal(clientFinanceDueDateLabel('0001-01-01'), '01/01/0001');
  assert.equal(clientFinanceDueDateLabel('0099-12-31'), '31/12/0099');
});

test('client billing links allow only credential-free HTTP or HTTPS URLs', () => {
  assert.equal(safeClientFinanceExternalHref('https://payments.example.test/ticket?id=1'), 'https://payments.example.test/ticket?id=1');
  assert.equal(safeClientFinanceExternalHref('http://payments.example.test/ticket'), 'http://payments.example.test/ticket');
  for (const value of ['javascript:alert(1)', 'data:text/html,unsafe', '//attacker.example/path', 'https://user:secret@example.test/ticket', '', null]) {
    assert.equal(safeClientFinanceExternalHref(value), '');
  }
});

test('client billing actions and badges use normalized provider status', () => {
  assert.deepEqual(clientBillingRecordState({ status: 'PENDING', paymentDetails: { status: 'CREATED' } }), {
    status: 'pending', label: 'Aguardando pagamento', paid: false, cancellable: true,
  });
  assert.deepEqual(clientBillingRecordState({ status: 'Recebida' }), {
    status: 'paid', label: 'Paga', paid: true, cancellable: false,
  });
  assert.equal(clientBillingRecordState({ status: 'pending', paymentDetails: { status: 'paid' } }).cancellable, false);
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

test('successful installment creation advances only the expected plan and rejects stale duplicate actions', () => {
  const plans = [
    { serviceId: 'website', service: 'Site', billingMode: 'installments', installments: 3, generatedInstallments: 1 },
    { serviceId: 'support', service: 'Suporte', billingMode: 'recurring', installments: 0 },
  ];
  const advanced = advanceClientInstallmentProgress(plans, 'website', 1);

  assert.equal(advanced.error, undefined);
  assert.deepEqual(advanced.charges[0], { ...plans[0], generatedInstallments: 2 });
  assert.equal(advanced.charges[1], plans[1]);
  assert.equal(plans[0].generatedInstallments, 1, 'the input remains immutable');
  assert.match(advanceClientInstallmentProgress(advanced.charges, 'website', 1).error, /mudou/);
  assert.match(advanceClientInstallmentProgress(advanced.charges, 'website', 3).error, /mudou/);
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

test('client finance settlement action is locked while its update is in flight', async () => {
  const source = await readFile(new URL('../screens/CommercialScreens.jsx', import.meta.url), 'utf8');
  const record = source.slice(source.indexOf('function ClientFinancialRecord('), source.indexOf('function ClientPlannedChargeRecord('));
  assert.match(record, /const settle = async \(\) => \{\s*if \(!settlement \|\| saving \|\| deleting\) return;/);
  assert.match(record, /disabled=\{deleting \|\| saving\} onClick=\{settle\}/);
  assert.match(record, /saving \? "Registrando baixa\.\.\."/);
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

test('manual finance update refreshes the visible row when API ID types differ', () => {
  const original = { id: 42, status: 'Pendente', amount: 100 };
  const other = { id: 43, status: 'Pendente' };
  const updated = mergeClientFinanceRecordUpdate([original, other], '42', row => ({ ...row, status: 'Recebida' }));

  assert.deepEqual(updated, [{ ...original, status: 'Recebida' }, other]);
  assert.equal(original.status, 'Pendente', 'the cached row remains immutable');
  const unchanged = [original];
  assert.equal(mergeClientFinanceRecordUpdate(unchanged, undefined, () => ({})), unchanged);
});

test('client financial load errors use clear Portuguese resource names', () => {
  assert.equal(clientFinanceResourceLabels(['billing', 'subscriptions', 'contracts', 'revenues', 'expenses']), 'cobranças, assinaturas, contratos, receitas, despesas');
  assert.equal(clientFinanceResourceLabels(['unknown']), 'unknown');
  assert.equal(clientFinanceResourceLabels(null), '');
});

test('failed client finance edits keep the editor open for correction or retry', async () => {
  const source = await readFile(new URL('../screens/CommercialScreens.jsx', import.meta.url), 'utf8');
  const record = source.slice(source.indexOf('function ClientFinancialRecord('), source.indexOf('function ClientPlannedChargeRecord('));
  assert.match(record, /const saved = await onUpdate\(patch\);\s*if \(saved !== false\) setEditing\(false\);/);
});

test('installment retries reuse an open or failed intent, and canceled installments receive a new intent key', async () => {
  const first = await resolveClientInstallmentRequest([], 'client-1', 'service-1', 0);
  const retry = await resolveClientInstallmentRequest([{ id: 'order-1', workspaceClientId: 'client-1', requestIdempotencyKey: first.key, status: 'pending' }], 'client-1', 'service-1', 0);
  assert.equal(retry.key, first.key);
  assert.equal(retry.existing.id, 'order-1');
  const failed = await resolveClientInstallmentRequest([{ id: 'order-2', workspaceClientId: 'client-1', requestIdempotencyKey: first.key, status: 'failed' }], 'client-1', 'service-1', 0);
  assert.equal(failed.key, first.key);
  assert.equal(failed.existing.status, 'failed');
  const canceled = await resolveClientInstallmentRequest([{ id: 'order-3', workspaceClientId: 'client-1', requestIdempotencyKey: first.key, status: 'cancelled' }], 'client-1', 'service-1', 0);
  assert.notEqual(canceled.key, first.key);
  assert.equal(canceled.existing, null);
  const legacy = await resolveClientInstallmentRequest([{ id: 'legacy-order', workspaceClientId: 'client-1', requestIdempotencyKey: 'legacy-key', description: 'Site - parcela 1/3', status: 'pending' }], 'client-1', 'service-1', 0, 'Site - parcela 1/3');
  assert.equal(legacy.existing.id, 'legacy-order');
  assert.equal(legacy.key, 'legacy-key');
  assert.notEqual(canceled.key, (await resolveClientInstallmentRequest([], 'client-1', 'service-1', 1)).key);
  assert.match(first.key, /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('client profile retries a failed installment-progress save without posting a second provider charge', async () => {
  const source = await readFile(new URL('../screens/CommercialScreens.jsx', import.meta.url), 'utf8');
  const save = source.slice(source.indexOf('const saveClientFinance = async event =>'), source.indexOf('const addClientFile = async file =>'));
  assert.match(save, /resolveClientInstallmentRequest\(related\.billing \|\| \[\], client\.id, financeDraft\.installmentServiceId, financeDraft\.installmentIndex, financeDraft\.description\)/);
  assert.match(save, /recoveredInstallmentOrder\s*\?\s*\{\s*data: recoveredInstallmentOrder/);
  assert.match(save, /await apiRequest\(endpoint/);
  assert.match(source, /disabled=\{Boolean\(financeDraft\.installmentServiceId\)\}/);
});

test('editing a client finance record preserves its existing CRM link fields', () => {
  const record = { id: 'r3', status: 'Pendente', resource: 'revenues', workspaceClientId: 'client-1', clientId: 'client-1', clientRecordId: 'client-1', clientName: 'Aurora', client: 'Aurora' };
  const patch = clientFinanceEditPatch(record, 'revenues', {
    description: 'Consultoria atualizada', amount: '300', date: '2026-10-02', status: 'Pendente',
  });
  assert.equal(patch.clientId, 'client-1');
  assert.equal(patch.clientName, 'Aurora');
  assert.equal(patch.client, 'Aurora');
  assert.equal(patch.workspaceClientId, 'client-1');
  assert.equal(patch.clientRecordId, 'client-1');
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
