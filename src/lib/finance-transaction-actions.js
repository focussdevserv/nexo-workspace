export function canDeleteFinanceAccountTransaction(transaction) {
  return Boolean(transaction?.id) && !transaction?.transferId;
}
