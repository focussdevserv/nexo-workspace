function toCents(value: unknown) {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount * 100)) || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-7) {
    throw new Error('finance_transfer_invalid_amount');
  }
  return Math.round(amount * 100);
}

export function calculateFinanceTransferBalances(sourceBalance: unknown, destinationBalance: unknown, amount: unknown) {
  const sourceCents = toCents(sourceBalance);
  const destinationCents = toCents(destinationBalance);
  const amountCents = toCents(amount);
  if (amountCents <= 0) throw new Error('finance_transfer_invalid_amount');
  if (sourceCents < amountCents) throw new Error('finance_transfer_insufficient_funds');
  if (!Number.isSafeInteger(destinationCents + amountCents)) throw new Error('finance_transfer_balance_overflow');
  return {
    sourceBalance: (sourceCents - amountCents) / 100,
    destinationBalance: (destinationCents + amountCents) / 100,
    amount: amountCents / 100,
  };
}
