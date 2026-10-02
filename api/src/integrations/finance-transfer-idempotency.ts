type TransferSide = 'debit' | 'credit';

export type FinanceTransferRow = {
  id: string;
  data: Record<string, unknown>;
};

export type FinanceTransferRequest = {
  sourceAccountId: string;
  destinationAccountId: string;
  description: string;
  amount: number;
  date: string;
};

function moneyCents(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

function sideMatches(row: FinanceTransferRow, side: TransferSide, request: FinanceTransferRequest) {
  const data = row.data;
  const debit = side === 'debit';
  const rowCents = moneyCents(data.amount);
  const requestCents = moneyCents(request.amount);
  return data.transferSide === side
    && data.direction === (debit ? 'Saída' : 'Entrada')
    && String(data.accountId || '') === (debit ? request.sourceAccountId : request.destinationAccountId)
    && String(data.relatedAccountId || '') === (debit ? request.destinationAccountId : request.sourceAccountId)
    && String(data.description || '').trim() === request.description
    && String(data.date || '') === request.date
    && rowCents !== null
    && rowCents === requestCents;
}

export function financeTransferReplayMatches(rows: FinanceTransferRow[], request: FinanceTransferRequest) {
  if (rows.length !== 2) return false;
  const debit = rows.find((row) => row.data.transferSide === 'debit');
  const credit = rows.find((row) => row.data.transferSide === 'credit');
  return Boolean(debit && credit && sideMatches(debit, 'debit', request) && sideMatches(credit, 'credit', request));
}
