export function tableStatusOptions(rows, statusColumn) {
  return ['Todos', ...new Set(rows.map((row) => String(row[statusColumn] ?? '').trim()).filter(Boolean))];
}

export function filterTableRows(rows, { query = '', status = 'Todos', statusColumn = 0 } = {}) {
  const needle = query.trim().toLocaleLowerCase('pt-BR');
  return rows.filter((row) => (!needle || row.join(' ').toLocaleLowerCase('pt-BR').includes(needle)) && (status === 'Todos' || row[statusColumn] === status));
}
