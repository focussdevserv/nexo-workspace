type FinanceTransactionRow = {
  data?: Record<string, unknown> | null;
};

export function linkedFinanceTransferIds(rows: FinanceTransactionRow[]) {
  return [...new Set(rows
    .map((row) => String(row.data?.transferId ?? '').trim())
    .filter(Boolean))];
}
