import { createHash, timingSafeEqual } from 'node:crypto';

export type ClicksignWebhookEvent = {
  name: string;
  documentId: string;
  envelopeId: string;
  documentStatus: string;
};

/** Clicksign signs the exact body bytes followed by the webhook secret. */
export function verifyClicksignWebhook(rawBody: Uint8Array, secret: string, signature: string | undefined) {
  if (!signature || !secret || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHash('sha256').update(rawBody).update(secret, 'utf8').digest();
  const provided = Buffer.from(signature.slice('sha256='.length), 'hex');
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function parseClicksignWebhookEvent(payload: unknown): ClicksignWebhookEvent | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const root = payload as Record<string, unknown>;
  const event = root.event && typeof root.event === 'object' ? root.event as Record<string, unknown> : null;
  const documentValue = Array.isArray(root.document) ? root.document[0] : root.document;
  const document = documentValue && typeof documentValue === 'object' ? documentValue as Record<string, unknown> : null;
  if (!event || !document || typeof event.name !== 'string') return null;
  const reference = (value: unknown) => typeof value === 'string' && value.length <= 200 ? value : '';
  const nestedEnvelope = document.envelope && typeof document.envelope === 'object' ? document.envelope as Record<string, unknown> : null;
  return {
    name: event.name.slice(0, 100),
    documentId: reference(document.id) || reference(document.key) || reference(document.document_key),
    envelopeId: reference(document.envelope_id) || reference(nestedEnvelope?.id) || reference(nestedEnvelope?.key),
    documentStatus: reference(document.status),
  };
}

export function clicksignWebhookEnvelopeStatus(event: ClicksignWebhookEvent) {
  if (['document_closed', 'auto_close', 'close'].includes(event.name)) return 'closed';
  if (['cancel', 'refusal'].includes(event.name)) return 'canceled';
  if (event.name === 'deadline') return event.documentStatus === 'closed' ? 'closed' : 'canceled';
  return 'running';
}

export function canApplyClicksignWebhookStatus(currentStatus: unknown, nextStatus: string) {
  if (currentStatus === 'Assinado' || currentStatus === 'Cancelado') return currentStatus === nextStatus;
  return true;
}

export function clicksignWebhookIsReady(webhooks: unknown, endpoint: string, requiredEvents: string[]) {
  if (!Array.isArray(webhooks)) return false;
  return webhooks.some((webhook) => {
    if (!webhook || typeof webhook !== 'object') return false;
    const attributes = (webhook as Record<string, unknown>).attributes;
    if (!attributes || typeof attributes !== 'object') return false;
    const config = attributes as Record<string, unknown>;
    const configuredEvents = config.events;
    return config.endpoint === endpoint && config.status === 'active' && Array.isArray(configuredEvents)
      && requiredEvents.every((event) => configuredEvents.includes(event));
  });
}

export function clicksignContractStatus(envelopeStatus: string) {
  if (envelopeStatus === 'closed') return { status: 'Assinado', tone: 'green' };
  if (envelopeStatus === 'canceled') return { status: 'Cancelado', tone: 'gray' };
  return { status: 'Aguardando assinatura', tone: 'amber' };
}
