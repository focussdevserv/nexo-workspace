export function isBillingOrderCancelable(status: unknown, providerStatus: unknown): boolean {
  const local = String(status ?? '').toLowerCase();
  const provider = String(providerStatus ?? '').toLowerCase();
  return ['pending', 'processing'].includes(local) && ['created', 'action_required'].includes(provider);
}
