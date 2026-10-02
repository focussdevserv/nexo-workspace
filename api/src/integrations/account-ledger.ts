function cents(value: unknown) {
  const amount = typeof value === 'number' ? value : Number(value);
  const rounded = Math.round(amount * 100);
  if (!Number.isFinite(amount) || !Number.isSafeInteger(rounded) || Math.abs(amount * 100 - rounded) > 1e-7) {
    throw new Error('finance_amount_invalid_precision');
  }
  return rounded;
}

export function isCurrencyAmount(value: number) {
  try { return cents(value) > 0; }
  catch { return false; }
}

export function isCurrencyBalance(value: unknown) {
  try { cents(value); return true; }
  catch { return false; }
}

export function calculateAccountMovementBalance(balance: unknown, direction: 'Entrada' | 'Saída', amount: unknown) {
  const currentCents = cents(balance);
  const amountCents = cents(amount);
  if (amountCents <= 0) throw new Error('finance_amount_invalid_precision');
  const nextCents = currentCents + (direction === 'Saída' ? -amountCents : amountCents);
  if (!Number.isSafeInteger(nextCents)) throw new Error('finance_balance_overflow');
  return nextCents / 100;
}

export function reverseAccountMovementBalance(balance: unknown, direction: unknown, amount: unknown) {
  if (direction !== 'Entrada' && direction !== 'Saída') throw new Error('finance_transaction_direction_invalid');
  return calculateAccountMovementBalance(balance, direction === 'Entrada' ? 'Saída' : 'Entrada', amount);
}
