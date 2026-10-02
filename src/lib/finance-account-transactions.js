const outgoingDirections = new Set(['saida', 'outgoing', 'debit', 'debito']);

function normalizeDirection(value, amount) {
  const direction = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (direction) return outgoingDirections.has(direction) ? 'Saída' : 'Entrada';
  return Number(amount) < 0 ? 'Saída' : 'Entrada';
}

export function normalizeFinanceAccountTransaction(row, accounts = []) {
  const accountName = String(row.accountName || row.account || '').trim();
  const account = accounts.find((item) => String(item.id) === String(row.accountId || '') || (accountName && item.name === accountName));
  const rawAmount = Number(row.amount) || 0;
  const direction = normalizeDirection(row.direction, rawAmount);
  return {
    ...row,
    accountId: row.accountId || account?.id || '',
    accountName: accountName || account?.name || '',
    direction,
    amount: Math.abs(rawAmount),
  };
}

export function filterFinanceAccountTransactions(rows, selectedAccountId, accounts = []) {
  const normalized = rows.map((row) => normalizeFinanceAccountTransaction(row, accounts));
  if (selectedAccountId === 'Todas') return normalized;
  const selected = accounts.find((account) => String(account.id) === String(selectedAccountId));
  return normalized.filter((row) => String(row.accountId) === String(selectedAccountId) || (selected && row.accountName === selected.name));
}

export function financeAccountTransactionSignedAmount(row) {
  const amount = Math.abs(Number(row.amount) || 0);
  return row.direction === 'Saída' ? -amount : amount;
}
