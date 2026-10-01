export function filterPayments(items, { status = 'Todos', due = 'Todos', now = Date.now() } = {}) {
  let rows = items;
  if (status !== 'Todos') rows = rows.filter((item) => item.status === status);
  if (due === 'Vencidas') {
    rows = rows.filter((item) => {
    const dueAt = Date.parse(item.dueAt || '');
    return String(item.status || '').toLowerCase() === 'pending' && Number.isFinite(dueAt) && dueAt < now;
    });
  } else if (due === 'Próximos 7 dias') {
    rows = rows.filter((item) => {
      const dueAt = Date.parse(item.dueAt || '');
      return String(item.status || '').toLowerCase() === 'pending' && Number.isFinite(dueAt) && dueAt >= now && dueAt <= now + 7 * 24 * 60 * 60 * 1000;
    });
  } else if (due === 'Sem vencimento') rows = rows.filter((item) => !item.dueAt || !Number.isFinite(Date.parse(item.dueAt)));
  return rows;
}

export function filterOverduePayments(items, now = Date.now()) { return filterPayments(items, { due: 'Vencidas', now }); }
