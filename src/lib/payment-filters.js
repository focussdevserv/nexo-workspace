function dueTimestamp(item) {
  const value = item.dueAt || item.dueDate;
  if (!value) return Number.NaN;
  const dateOnly = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateOnly) return Date.parse(value);

  const [, year, month, day] = dateOnly;
  const original = new Date(0);
  original.setFullYear(Number(year), Number(month) - 1, Number(day));
  original.setHours(0, 0, 0, 0);
  if (original.getFullYear() !== Number(year) || original.getMonth() !== Number(month) - 1 || original.getDate() !== Number(day)) return Number.NaN;
  const nextDay = new Date(original);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay.getTime() - 1;
}

export function filterPayments(items, { status = 'Todos', due = 'Todos', now = Date.now() } = {}) {
  let rows = items;
  if (status !== 'Todos') rows = rows.filter((item) => item.status === status);
  if (due === 'Vencidas') {
    rows = rows.filter((item) => {
      const currentStatus = String(item.status || '').trim().toLocaleLowerCase('pt-BR');
      const explicitlyOverdue = ['overdue', 'vencida', 'atrasada'].includes(currentStatus);
      const dueAt = dueTimestamp(item);
      return explicitlyOverdue || (currentStatus === 'pending' && Number.isFinite(dueAt) && dueAt < now);
    });
  } else if (due === 'Próximos 7 dias') {
    rows = rows.filter((item) => {
      const dueAt = dueTimestamp(item);
      return String(item.status || '').toLowerCase() === 'pending' && Number.isFinite(dueAt) && dueAt >= now && dueAt <= now + 7 * 24 * 60 * 60 * 1000;
    });
  } else if (due === 'Sem vencimento') rows = rows.filter((item) => !Number.isFinite(dueTimestamp(item)));
  return rows;
}

export function filterOverduePayments(items, now = Date.now()) { return filterPayments(items, { due: 'Vencidas', now }); }
