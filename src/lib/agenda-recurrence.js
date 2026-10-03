const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function addDays(date, amount) {
  const match = datePattern.exec(String(date || ''));
  if (!match) return '';
  const [, year, month, day] = match.map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + amount));
  return value.toISOString().slice(0, 10);
}

function monthlyDate(startDate, sequence, anchorDay) {
  const match = datePattern.exec(String(startDate || ''));
  if (!match) return '';
  const [, year, month] = match.map(Number);
  const absoluteMonth = year * 12 + month - 1 + sequence;
  const targetYear = Math.floor(absoluteMonth / 12);
  const targetMonth = absoluteMonth % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(Math.min(anchorDay, lastDay)).padStart(2, '0')}`;
}

export function buildAgendaRecurrenceSeries(event, { recurrence = 'none', count = 1, seriesId = event?.id, makeId = (sequence) => `${seriesId}-${sequence + 1}` } = {}) {
  const source = event && typeof event === 'object' ? event : {};
  const mode = ['daily', 'weekly', 'monthly'].includes(recurrence) ? recurrence : 'none';
  const total = mode === 'none' ? 1 : Math.max(2, Math.min(52, Math.trunc(Number(count) || 2)));
  const match = datePattern.exec(String(source.date || ''));
  const validDate = match && (() => { const [, year, month, day] = match.map(Number); const parsed = new Date(Date.UTC(year, month - 1, day)); return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day; })();
  if (!validDate) throw new Error('Informe uma data válida antes de criar a recorrência.');
  const anchorDay = Number(match[3]);
  const events = [];
  for (let sequence = 0; sequence < total; sequence += 1) {
    const date = sequence === 0 ? source.date
      : mode === 'daily' ? addDays(source.date, sequence)
        : mode === 'weekly' ? addDays(source.date, sequence * 7)
          : monthlyDate(source.date, sequence, anchorDay);
    const nextDay = addDays(date, 1);
    const endDate = source.allDay || (source.endDate && source.endDate !== source.date) ? nextDay : date;
    events.push({
      ...source,
      id: sequence === 0 ? source.id : makeId(sequence),
      date,
      endDate,
      recurrence: mode,
      recurrenceId: mode === 'none' ? '' : seriesId,
      recurrenceSequence: sequence + 1,
      googleEventId: sequence === 0 ? source.googleEventId || '' : '',
      googleMeetUrl: sequence === 0 ? source.googleMeetUrl || '' : '',
      calendarSyncStatus: mode === 'none' ? source.calendarSyncStatus : 'internal_only',
      calendarSyncError: mode === 'none' ? source.calendarSyncError || '' : '',
    });
  }
  return events;
}
