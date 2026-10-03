import { billingPayloadFingerprint } from './billing-request-idempotency.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Create a browser-only billing record with the same retry guarantees as the live API. */
export function createLocalDemoBillingRecord(store, resource, body, headers = {}, now = new Date(), makeId = () => crypto.randomUUID()) {
  const records = Array.isArray(store[resource]) ? store[resource] : [];
  const rawKey = Object.entries(headers || {}).find(([name]) => name.toLowerCase() === 'idempotency-key')?.[1];
  if (rawKey != null && !UUID_PATTERN.test(String(rawKey))) throw new Error('Envie uma chave Idempotency-Key válida.');

  store.billingCreateAttempts ||= {};
  const operation = resource === 'billing-subscriptions' ? 'subscriptions' : 'orders';
  const attemptKey = rawKey ? `${resource}:${rawKey}` : '';
  const fingerprint = billingPayloadFingerprint(operation, body);
  const previous = attemptKey ? store.billingCreateAttempts[attemptKey] : null;
  if (previous) {
    if (previous.fingerprint !== fingerprint) throw new Error('Esta tentativa de cobrança já foi usada com outros dados. Confira a lista antes de criar outra.');
    const existing = records.find((item) => String(item.id) === String(previous.id));
    if (!existing) throw new Error('Esta cobrança desta tentativa já foi removida. Atualize a lista antes de tentar novamente.');
    return { ...existing, idempotent: true };
  }

  const item = {
    id: `demo-${resource}-${makeId()}`,
    ...body,
    ...(body?.dueDate ? { dueAt: `${body.dueDate}T23:59:59-03:00` } : {}),
    status: 'pending',
    demoTag: 'DEMONSTRAÇÃO LOCAL · SEM AÇÃO EXTERNA',
    createdAt: now.toISOString(),
    paymentDetails: { simulated: true },
  };
  store[resource] = [item, ...records];
  if (attemptKey) store.billingCreateAttempts[attemptKey] = { fingerprint, id: String(item.id) };
  return item;
}
