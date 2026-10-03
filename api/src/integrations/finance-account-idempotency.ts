export type FinanceAccountMovementRow = {
  id: string;
  data: Record<string, unknown>;
};

export type FinanceAccountMovementRequest = {
  accountId: string;
  description: string;
  direction: 'Entrada' | 'Saída';
  amount: number;
  date: string;
};

function amountInCents(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

export function financeAccountMovementReplayMatches(rows: FinanceAccountMovementRow[], request: FinanceAccountMovementRequest) {
  if (rows.length !== 1) return false;
  const data = rows[0]!.data;
  const rowAmount = amountInCents(data.amount);
  const requestAmount = amountInCents(request.amount);
  return String(data.accountId || '') === request.accountId
    && String(data.description || '').trim() === request.description
    && data.direction === request.direction
    && String(data.date || '') === request.date
    && rowAmount !== null
    && rowAmount === requestAmount;
}
