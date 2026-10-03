import { isFinanceReceivableStatusOpen } from './finance-receivable-status.js';
import { canCancelPaymentOrder, normalizePaymentStatus } from './payment-status.js';
import { parseCalendarDateKey } from './calendar-preferences.js';

const settledStatuses = new Set(['recebida', 'recebido', 'paga', 'pago', 'paid', 'received', 'settled']);
const cancelledStatuses = new Set(['cancelada', 'cancelado', 'cancelled', 'canceled', 'estornada', 'refunded']);

export function clientFinanceDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function clientFinanceDueDateLabel(value) {
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      if (!parseCalendarDateKey(value)) return '';
      const [year, month, day] = value.split('-');
      return `${day}/${month}/${year}`;
    }
  }
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

const clientBillingStatusLabels = {
  pending: 'Aguardando pagamento', creating: 'Criando', processing: 'Em processamento', paid: 'Paga',
  overdue: 'Vencida', failed: 'Falhou', refunded: 'Estornada', canceled: 'Cancelada', expired: 'Expirada',
};

export function clientBillingRecordState(item, localDemo = false) {
  const status = normalizePaymentStatus(item?.status);
  return {
    status,
    label: clientBillingStatusLabels[status] || item?.status || 'Sem status',
    paid: status === 'paid',
    cancellable: canCancelPaymentOrder(item, localDemo),
  };
}

const terminalInstallmentOrderStatuses = new Set(['canceled', 'expired', 'refunded', 'rejected']);

export async function clientInstallmentIdempotencyKey(clientId, serviceId, installmentIndex, generation = 0) {
  const cryptoApi = globalThis.crypto;
  const TextEncoderApi = globalThis.TextEncoder;
  if (!cryptoApi?.subtle?.digest || !TextEncoderApi) {
    throw new Error('Este navegador não oferece proteção segura para repetir esta parcela. Atualize o navegador e tente novamente.');
  }
  const source = `focusshub:client-installment:v1:${String(clientId)}:${String(serviceId)}:${installmentIndex}:${generation}`;
  const digest = new Uint8Array(await cryptoApi.subtle.digest('SHA-256', new TextEncoderApi().encode(source)));
  digest[6] = (digest[6] & 0x0f) | 0x80;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest.subarray(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Reuse an open/failed installment intent; start a new generation after a terminal cancellation. */
export async function resolveClientInstallmentRequest(billing, clientId, serviceId, installmentIndex, description = '') {
  if (!clientId || !serviceId || !Number.isInteger(installmentIndex) || installmentIndex < 0) {
    return { error: 'O contexto desta parcela está incompleto. Atualize a ficha do cliente antes de continuar.' };
  }
  const records = Array.isArray(billing) ? billing : [];
  for (let generation = 0; generation < 100; generation += 1) {
    const key = await clientInstallmentIdempotencyKey(clientId, serviceId, installmentIndex, generation);
    const existing = records.find((item) => item?.requestIdempotencyKey === key);
    if (!existing) {
      const legacyOrder = generation === 0 && description
        ? records.find((item) => String(item?.workspaceClientId || '') === String(clientId)
          && String(item?.description || '').trim() === String(description).trim()
          && !terminalInstallmentOrderStatuses.has(normalizePaymentStatus(item?.status)))
        : null;
      if (legacyOrder) return { key: legacyOrder.requestIdempotencyKey || key, existing: legacyOrder, legacy: true };
      return { key, existing: null };
    }
    if (String(existing.workspaceClientId || '') !== String(clientId)) {
      return { error: 'A chave desta parcela já está vinculada a outro cliente. Atualize a ficha antes de tentar novamente.' };
    }
    if (terminalInstallmentOrderStatuses.has(normalizePaymentStatus(existing.status))) continue;
    return { key, existing };
  }
  return { error: 'Esta parcela possui muitas tentativas encerradas. Revise o histórico financeiro antes de gerar outra cobrança.' };
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

/** A new recurring subscription must not inherit dates from an earlier draft. */
export function clientFinanceScheduleForCreate(context, defaultStartAt) {
  return {
    startAt: context?.startAt || defaultStartAt,
    endAt: context?.endAt || '',
  };
}

/** Build each in-profile finance creation form from current context, never stale draft data. */
export function clientFinanceDraftForCreate({ currentDraft, page, context = {}, client, defaultDueDate, defaultStartAt }) {
  const kinds = { Assinaturas: 'recurring', Receitas: 'revenue', Despesas: 'expense', 'Cobranças': 'single' };
  const schedule = clientFinanceScheduleForCreate(context, defaultStartAt);
  return {
    ...currentDraft,
    kind: kinds[page] || 'single',
    description: context.description ?? '',
    amount: context.amount == null ? '' : String(context.amount),
    dueDate: context.dueDate || defaultDueDate,
    frequency: context.frequency || 'months',
    frequencyInterval: String(context.frequencyInterval || 1),
    payerEmail: context.clientEmail || client?.email || '',
    startAt: schedule.startAt,
    endAt: schedule.endAt,
    installmentServiceId: context.installmentServiceId || '',
    installmentIndex: Number.isInteger(context.installmentIndex) ? context.installmentIndex : null,
  };
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

export function clientFinanceResourceLabels(resources = []) {
  const labels = {
    billing: 'cobranças',
    subscriptions: 'assinaturas',
    contracts: 'contratos',
    revenues: 'receitas',
    expenses: 'despesas',
  };
  return (Array.isArray(resources) ? resources : [])
    .map((resource) => labels[resource] || String(resource))
    .join(', ');
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
  const generated = Math.max(0, Number(current.generatedInstallments) || 0);
  if (billingMode !== 'none') {
    const amount = Number(String(draft.amount || '').replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return { error: 'Informe um valor maior que zero e de até R$ 1.000.000,00.' };
    next.amount = amount;
  }
  if (billingMode === 'installments') {
    const installments = Number(draft.installments);
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

/** Merge a saved finance row into the client-profile cache across API ID types. */
export function mergeClientFinanceRecordUpdate(rows, recordId, update) {
  if (!Array.isArray(rows) || recordId === undefined || recordId === null || typeof update !== 'function') return rows;
  const key = String(recordId);
  return rows.map((row) => row && String(row.id) === key ? update(row) : row);
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
  // The CRM sends this as a PATCH, but some workspace adapters replace the
  // resource data with the submitted object. Keep any existing client link
  // fields in the edit payload so an ordinary finance edit cannot orphan it.
  for (const field of ['workspaceClientId', 'clientId', 'clientRecordId', 'clientName', 'client']) {
    if (Object.prototype.hasOwnProperty.call(record || {}, field)) patch[field] = record[field];
  }
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
