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
  const withoutNextAction = filter === 'Sem pr\u00f3xima a\u00e7\u00e3o';
  return records.filter((record) => {
    const text = Object.values(record || {}).map(searchableValue).join(' ').toLocaleLowerCase('pt-BR');
    const status = record.status || record.stage;
    const matchesExtra = extraFilterFields.every((field) => (
      !extraFilters[field.key]
      || String(field.read ? field.read(record) || '' : record[field.key] || '') === extraFilters[field.key]
    ));
    const matchesArchive = filter === 'Arquivado' ? Boolean(record.archivedAt) : !record.archivedAt;
    const stage = String(record.stage || record.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    const matchesNextAction = !withoutNextAction
      || (!['fechado', 'perdido', 'ganho', 'won', 'lost'].includes(stage) && !String(record.nextAction ?? '').trim());
    return (!term || text.includes(term))
      && matchesArchive
      && matchesNextAction
      && (filter === 'Todos' || filter === 'Arquivado' || withoutNextAction || status === filter || record.source === filter)
      && matchesExtra;
  });
}
