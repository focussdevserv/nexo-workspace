export type RecurringAgendaInput = { clientId: string; data: Record<string, unknown> };

function parseDate(value: unknown) {
  const text = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === text ? date : null;
}

function dateAt(start: Date, recurrence: string, sequence: number, anchorDay: number) {
  if (recurrence === 'daily' || recurrence === 'weekly') {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + sequence * (recurrence === 'weekly' ? 7 : 1));
    return date.toISOString().slice(0, 10);
  }
  const absoluteMonth = start.getUTCFullYear() * 12 + start.getUTCMonth() + sequence;
  const year = Math.floor(absoluteMonth / 12);
  const month = absoluteMonth % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(anchorDay, lastDay)).padStart(2, '0')}`;
}

export function validateRecurringAgendaSeries(seriesId: string, entries: RecurringAgendaInput[]) {
  if (!seriesId.trim() || entries.length < 2 || entries.length > 52) return false;
  const first = entries[0]!.data;
  const recurrence = String(first.recurrence || '');
  if (!['daily', 'weekly', 'monthly'].includes(recurrence)) return false;
  const start = parseDate(first.date);
  const title = String(first.title || '').trim();
  if (!start || !title || title.length > 240) return false;
  const anchorDay = start.getUTCDate();
  const seenIds = new Set<string>();
  return entries.every(({ clientId, data }, index) => {
    const id = String(clientId || '');
    const date = parseDate(data.date);
    const endDate = parseDate(data.endDate);
    if (!id || id.length > 128 || seenIds.has(id) || !date || !endDate) return false;
    seenIds.add(id);
    const time = String(data.time || '');
    const end = String(data.end || '');
    if (String(data.endDate) < String(data.date) || (data.allDay !== true && (!/^\d{2}:\d{2}$/.test(time) || !/^\d{2}:\d{2}$/.test(end) || (data.endDate === data.date && end <= time)))) return false;
    const sequence = index + 1;
    return String(data.recurrenceId || '') === seriesId
      && String(data.recurrence || '') === recurrence
      && Number(data.recurrenceSequence) === sequence
      && Number(data.recurrenceCount) === entries.length
      && String(data.date) === dateAt(start, recurrence, index, anchorDay)
      && String(data.title || '').trim() === title;
  });
}

export function recurringAgendaSeriesMatches(existing: Array<{ data: Record<string, unknown> }>, entries: RecurringAgendaInput[]) {
  if (existing.length !== entries.length) return false;
  const bySequence = new Map(existing.map((row) => [Number(row.data.recurrenceSequence), row.data]));
  return entries.every(({ data }, index) => {
    const saved = bySequence.get(index + 1);
    return Boolean(saved
      && String(saved.date) === String(data.date)
      && String(saved.title || '').trim() === String(data.title || '').trim()
      && String(saved.recurrence || '') === String(data.recurrence || '')
      && Number(saved.recurrenceCount) === entries.length);
  });
}
