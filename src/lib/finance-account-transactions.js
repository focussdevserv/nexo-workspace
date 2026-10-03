const outgoingDirections = new Set(['saida', 'outgoing', 'debit', 'debito']);

function normalizeDirection(value, amount) {
  const direction = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (direction) return outgoingDirections.has(direction) ? 'Saída' : 'Entrada';
  return Number(amount) < 0 ? 'Saída' : 'Entrada';
}

export function normalizeFinanceAccountTransaction(row, accounts = []) {
  const accountName = String(row.accountName || row.account || '').trim();
  // An explicit ID is authoritative. Falling back to a matching name when that
  // ID is stale can silently move a transaction to a different account.
  const account = row.accountId
    ? accounts.find((item) => String(item.id) === String(row.accountId))
    : accounts.filter((item) => accountName && item.name === accountName).length === 1
      ? accounts.find((item) => item.name === accountName)
      : undefined;
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
  return normalized.filter((row) => {
    // Never use names to widen a row that already has a stable account ID.
    if (row.accountId) return String(row.accountId) === String(selectedAccountId);
    if (!selected || row.accountName !== selected.name) return false;
    // Legacy name-only rows are safe to associate only when the name identifies
    // exactly one account. Duplicate labels are ambiguous and remain unassigned.
    return accounts.filter((account) => account.name === selected.name).length === 1;
  });
}

export function financeAccountTransactionSignedAmount(row) {
  const amount = Math.abs(Number(row.amount) || 0);
  return row.direction === 'Saída' ? -amount : amount;
}
