export function financeRecordListState({ records, loading, error }) {
  if (loading) return 'loading';
  if (error) return 'error';
  return records.length ? 'ready' : 'empty';
}
