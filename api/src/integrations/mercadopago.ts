export type MercadoPagoPaymentSnapshot = {
  status: string;
  statusDetail?: string | null;
  paymentId?: string | null;
};

export function sameMercadoPagoPaymentSnapshot(
  current: MercadoPagoPaymentSnapshot,
  incoming: MercadoPagoPaymentSnapshot,
) {
  return current.status === incoming.status
    && (current.statusDetail || '') === (incoming.statusDetail || '')
    && (current.paymentId || null) === (incoming.paymentId || null);
}
