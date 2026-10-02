function searchableValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }
  return String(value);
}

export function filterCommercialRecords(records = [], {
  search = '',
  filter = 'Todos',
  extraFilters = {},
  extraFilterFields = [],
} = {}) {
  const term = String(search).trim().toLocaleLowerCase('pt-BR');
  return records.filter((record) => {
    const text = Object.values(record || {}).map(searchableValue).join(' ').toLocaleLowerCase('pt-BR');
    const status = record.status || record.stage;
    const matchesExtra = extraFilterFields.every((field) => (
      !extraFilters[field.key]
      || String(field.read ? field.read(record) || '' : record[field.key] || '') === extraFilters[field.key]
    ));
    return (!term || text.includes(term))
      && (filter === 'Todos' || status === filter || record.source === filter)
      && matchesExtra;
  });
}
