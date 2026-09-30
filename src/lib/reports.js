export const dateOf = (item, field = 'default') => {
  const candidates = field === 'created' ? [item.createdAt, item.date, item.updatedAt]
    : field === 'expense' ? [item.date, item.createdAt, item.updatedAt]
      : field === 'paid' ? [item.paidAt, item.updatedAt, item.createdAt]
        : field === 'completed' ? [item.completedAt, item.updatedAt, item.createdAt]
          : field === 'work' ? [item.startedAt, item.createdAt, item.date]
            : [item.date, item.createdAt, item.paidAt, item.updatedAt, item.dueAt];
  const value = candidates.find(Boolean);
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value || 0);
};

export const periodStart = (periodId, now = new Date()) => periodId === 'year'
  ? new Date(now.getFullYear(), 0, 1)
  : periodId === 'quarter'
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 89, 0, 0, 0, 0)
    : new Date(now.getFullYear(), now.getMonth(), 1);

export const inPeriod = (item, periodId, now = new Date(), field = 'default') => {
  const date = dateOf(item, field);
  return !Number.isNaN(date.getTime()) && date >= periodStart(periodId, now) && date <= now;
};

export function buildChartBuckets(periodId, now, rows, valueOf, dateField = 'default') {
  const starts = periodId === 'year'
    ? Array.from({ length: 12 }, (_, index) => new Date(now.getFullYear(), index, 1))
    : periodId === 'quarter'
      ? Array.from({ length: 13 }, (_, index) => { const date = new Date(now); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - 89 + index * 7); return date; })
      : [new Date(now.getFullYear(), now.getMonth(), 1)];
  return starts.map((start, index) => {
    const end = periodId === 'year' || periodId === 'month'
      ? new Date(start.getFullYear(), start.getMonth() + 1, 1)
      : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    const value = rows.filter((row) => { const date = dateOf(row, dateField); return date >= start && date < end && date <= now; }).reduce((sum, row) => sum + valueOf(row), 0);
    const label = periodId === 'quarter'
      ? start.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
      : start.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    return { key: `${start.toISOString()}-${index}`, label, value };
  });
}
