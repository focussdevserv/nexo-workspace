import { isFinanceReceivableStatusOpen } from './finance-receivable-status.js';

const settledStatuses = new Set(['recebida', 'recebido', 'paga', 'pago', 'paid', 'received', 'settled']);
const cancelledStatuses = new Set(['cancelada', 'cancelado', 'cancelled', 'canceled', 'estornada', 'refunded']);

export function clientFinanceDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function clientFinanceDueDateLabel(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(date);
}

export function safeClientFinanceExternalHref(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export function clientFinanceFilterForPage(page) {
  const normalized = String(page || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
  if (normalized === 'receitas') return 'revenues';
  if (normalized === 'despesas') return 'expenses';
  if (normalized === 'assinaturas') return 'subscriptions';
  if (normalized === 'cobrancas') return 'billing';
  if (normalized === 'contratos') return 'contracts';
  return 'all';
}

export function clientFinanceLegacyClientValue(resource, record) {
  // Expense counterparties are usually vendors, so only use an explicit
  // client field for legacy records that predate clientId linking.
  if (resource === 'expenses') return record?.clientName ?? record?.client;
  if (resource === 'revenues') return record?.clientName ?? record?.client ?? record?.counterparty;
  return record?.clientName ?? record?.client;
}

const clientFinanceResourcesByFilter = {
  all: ['billing', 'subscriptions', 'contracts', 'revenues', 'expenses'],
  billing: ['billing'],
  subscriptions: ['subscriptions'],
  contracts: ['contracts'],
  revenues: ['revenues'],
  expenses: ['expenses'],
};

export function clientFinanceFailedResources(filter, errors = {}) {
  return (clientFinanceResourcesByFilter[filter] || clientFinanceResourcesByFilter.all)
    .filter((resource) => Boolean(errors[resource]));
}

export function clientFinanceFilterCounts({ contracts = [], subscriptions = [], billing = [], revenues = [], expenses = [], plannedCharges = [] }) {
  const planned = Array.isArray(plannedCharges) ? plannedCharges : [];
  return {
    all: contracts.length + subscriptions.length + billing.length + revenues.length + expenses.length + planned.length,
    billing: billing.length + planned.filter((charge) => charge.billingMode !== 'recurring').length,
    contracts: contracts.length,
    subscriptions: subscriptions.length + planned.filter((charge) => charge.billingMode === 'recurring').length,
    revenues: revenues.length,
    expenses: expenses.length,
  };
}

export function prepareClientServiceChargeUpdate(charges, index, draft) {
  if (!Array.isArray(charges) || !Number.isInteger(index) || index < 0 || index >= charges.length) {
    return { error: 'Este serviço planejado não está mais disponível. Atualize a ficha do cliente.' };
  }
  const current = charges[index];
  const service = String(draft?.service || '').trim();
  const billingMode = String(draft?.billingMode || 'none');
  if (!service || service.length > 180) return { error: 'Informe um nome de serviço com até 180 caracteres.' };
  if (!['none', 'single', 'installments', 'recurring'].includes(billingMode)) return { error: 'Escolha uma condição de cobrança válida.' };

  const next = { ...current, service, billingMode };
  if (billingMode !== 'none') {
    const amount = Number(String(draft.amount || '').replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return { error: 'Informe um valor maior que zero e de até R$ 1.000.000,00.' };
    next.amount = amount;
  }
  if (billingMode === 'installments') {
    const installments = Number(draft.installments);
    const generated = Math.max(0, Number(current.generatedInstallments) || 0);
    if (!Number.isInteger(installments) || installments < 2 || installments > 24) return { error: 'O parcelamento precisa ter de 2 a 24 parcelas.' };
    if (installments < generated) return { error: `Este serviço já tem ${generated} parcelas emitidas; não reduza o total abaixo desse número.` };
    next.installments = installments;
  }
  if (billingMode === 'recurring') {
    const interval = Number(draft.frequencyInterval);
    if (!['days', 'months'].includes(String(draft.frequencyUnit)) || !Number.isInteger(interval) || interval < 1 || interval > 24) {
      return { error: 'Escolha uma recorrência entre 1 e 24 dias ou meses.' };
    }
    next.frequency = `${draft.frequencyUnit}:${interval}`;
  }
  return { charges: charges.map((charge, itemIndex) => itemIndex === index ? next : charge), updated: next };
}

export function advanceClientInstallmentProgress(charges, serviceId, expectedIndex) {
  if (!Array.isArray(charges) || !serviceId || !Number.isInteger(expectedIndex) || expectedIndex < 0) {
    return { error: 'Este parcelamento não está mais disponível. Atualize a ficha do cliente.' };
  }
  const index = charges.findIndex((charge) => String(charge.serviceId || charge.id || '') === String(serviceId));
  if (index < 0) return { error: 'Este parcelamento não está mais disponível. Atualize a ficha do cliente.' };
  const current = charges[index];
  const generated = Math.max(0, Number(current.generatedInstallments) || 0);
  const total = Number(current.installments);
  if (current.billingMode !== 'installments' || generated !== expectedIndex || !Number.isInteger(total) || generated >= total) {
    return { error: 'O progresso deste parcelamento mudou. Atualize a ficha do cliente antes de gerar outra cobrança.' };
  }
  const next = { ...current, generatedInstallments: generated + 1 };
  return { charges: charges.map((charge, itemIndex) => itemIndex === index ? next : charge), updated: next };
}

export function prepareClientContractTrackingPatch(draft) {
  const renewal = String(draft?.renewal || '').trim();
  const internalNote = String(draft?.internalNote || '').trim();
  if (renewal.length > 120) return { error: 'A vigência deve ter até 120 caracteres.' };
  if (internalNote.length > 2000) return { error: 'A nota interna deve ter até 2.000 caracteres.' };
  return { patch: { renewal, internalNote } };
}

function normalizeFinanceStatus(status) {
  return String(status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

export function isClientFinanceSettled(record) {
  return settledStatuses.has(normalizeFinanceStatus(record?.status));
}

export function isClientFinanceCancelled(record) {
  return cancelledStatuses.has(normalizeFinanceStatus(record?.status));
}

export function clientFinanceOpenBillingCount(billing = []) {
  return billing.filter((item) => isFinanceReceivableStatusOpen(item?.status)).length;
}

export function manualFinanceSettlementPatch(record, now = new Date()) {
  if (isClientFinanceSettled(record) || isClientFinanceCancelled(record)) return null;
  const timestamp = now.toISOString();
  return {
    status: record?.resource === 'expenses' ? 'Paga' : 'Recebida',
    settledAt: timestamp,
    paidAt: timestamp,
  };
}

export function clientFinanceEditPatch(record, resource, draft, now = new Date()) {
  const patch = {
    description: String(draft?.description || '').trim(),
    amount: Number(draft?.amount),
    date: String(draft?.date || ''),
    status: String(draft?.status || record?.status || 'Pendente'),
  };
  // Saving ordinary edits must never silently register a payment. Add the
  // settlement timestamps only when the user explicitly chooses a settled state.
  if (isClientFinanceSettled({ status: patch.status }) && !isClientFinanceSettled(record)) {
    Object.assign(patch, manualFinanceSettlementPatch({ ...record, resource, status: 'Pendente' }, now));
  }
  return patch;
}

export function normalizeClientSubscriptionTerms(frequency, frequencyInterval) {
  const unit = String(frequency || '');
  const interval = Number(frequencyInterval);
  if (!['days', 'months'].includes(unit)) {
    return { error: 'Escolha uma recorrência em dias ou meses.' };
  }
  if (!Number.isInteger(interval) || interval < 1 || interval > 24) {
    return { error: 'O intervalo da assinatura deve ser de 1 a 24 dias ou meses.' };
  }
  return { frequency: unit, frequencyInterval: interval };
}

export function buildClientFinanceHistory({ billing = [], subscriptions = [], revenues = [], expenses = [] }) {
  const rows = [
    ...billing.map((item) => ({ ...item, kind: 'Cobrança', date: item.paidAt || item.updatedAt || item.createdAt })),
    ...subscriptions.map((item) => ({ ...item, kind: 'Assinatura', date: item.updatedAt || item.createdAt || item.startAt })),
    ...revenues.map((item) => ({ ...item, kind: 'Receita', date: item.settledAt || item.paidAt || item.updatedAt || item.createdAt || item.date })),
    ...expenses.map((item) => ({ ...item, kind: 'Despesa', date: item.settledAt || item.paidAt || item.updatedAt || item.createdAt || item.date })),
  ];
  return rows
    .filter((item) => item.date && !Number.isNaN(new Date(item.date).getTime()))
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
}
