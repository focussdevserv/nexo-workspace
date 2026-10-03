import { calendarDateKeyInTimeZone } from './calendar-preferences.js';

export function defaultManualHoursDate(instant = new Date(), timeZone) {
  return calendarDateKeyInTimeZone(instant, timeZone);
}

export function hoursEntryLocalDate(item, timeZone) {
  const storedDate = String(item?.date || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(storedDate)) return storedDate;

  // A time entry belongs to the work date on which it started. Using endedAt
  // first moves overnight sessions into the following day (and can move them
  // into a different week or month in the Hours period filters).
  const timestamp = item?.startedAt || item?.endedAt || item?.date;
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return calendarDateKeyInTimeZone(date, timeZone);
}

export function hoursEntryIsInDateRange(item, timeZone, from, to) {
  const entryDate = hoursEntryLocalDate(item, timeZone);
  return Boolean(entryDate && entryDate >= from && entryDate <= to);
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function dateKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function hoursDateRange(period, now = new Date(), timeZone, weekStart = 'monday') {
  const todayKey = calendarDateKeyInTimeZone(now, timeZone);
  const [year, month, day] = todayKey.split('-').map(Number);
  const today = new Date(Date.UTC(year, month - 1, day));
  const weekday = today.getUTCDay();
  const weekOffset = weekStart === 'sunday' ? weekday : (weekday + 6) % 7;
  let start;
  let end;

  if (period === 'Semana passada') {
    start = addDays(today, -weekOffset - 7);
    end = addDays(start, 6);
  } else if (period === 'Este mês') {
    start = new Date(Date.UTC(year, month - 1, 1));
    end = today;
  } else {
    start = addDays(today, -weekOffset);
    end = today;
  }

  return [dateKey(start), dateKey(end)];
}

export function formatHoursEntryEnd(value, timeZone) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}
