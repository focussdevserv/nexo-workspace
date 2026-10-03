const monthSteps = { weekly: null, monthly: 1, quarterly: 3, yearly: 12 };

function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) throw new Error('Informe uma data válida para a recorrência.');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Informe uma data válida para a recorrência.');
  return date;
}

function addMonthsFromAnchor(anchor, months) {
  const month = anchor.getUTCMonth() + months;
  const year = anchor.getUTCFullYear() + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const day = Math.min(anchor.getUTCDate(), new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, targetMonth, day));
}

export function buildLocalDemoFinanceDates(startDate, dueDate, frequency, count) {
  if (!Object.hasOwn(monthSteps, frequency) || !Number.isInteger(Number(count)) || Number(count) < 2 || Number(count) > 60) {
    throw new Error('Informe uma frequência e quantidade válidas para a recorrência.');
  }
  const anchor = parseDay(startDate);
  const dueAnchor = dueDate ? parseDay(dueDate) : null;
  const dueOffset = dueAnchor ? Math.round((dueAnchor.getTime() - anchor.getTime()) / 86_400_000) : null;
  return Array.from({ length: Number(count) }, (_, index) => {
    const date = monthSteps[frequency] === null
      ? new Date(anchor.getTime() + index * 7 * 86_400_000)
      : addMonthsFromAnchor(anchor, index * monthSteps[frequency]);
    return {
      date: date.toISOString().slice(0, 10),
      dueDate: dueOffset === null ? null : new Date(date.getTime() + dueOffset * 86_400_000).toISOString().slice(0, 10),
    };
  });
}
