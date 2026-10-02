export type MercadoPagoWebhookResource = 'order' | 'subscription' | null;

export function mercadoPagoWebhookResource(topic: string | undefined): MercadoPagoWebhookResource {
  if (topic === 'order') return 'order';
  if (topic === 'subscription_preapproval') return 'subscription';
  return null;
}

export function matchesMercadoPagoExternalReference(actual: unknown, expectedId: string) {
  return typeof actual === 'string' && actual === expectedId;
}

export function mercadoPagoAccountMatchesRecord(recordAccountId: string | null | undefined, connectedAccountId: string | null | undefined, legacySingletonSafe: boolean) {
  if (connectedAccountId) return recordAccountId === connectedAccountId;
  return legacySingletonSafe && !recordAccountId;
}
