export const DEFAULT_CALENDAR_TIME_ZONE = 'America/Sao_Paulo';

export function normalizeCalendarTimeZone(value) {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_CALENDAR_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
    return value;
  } catch {
    return DEFAULT_CALENDAR_TIME_ZONE;
  }
}

export function normalizeWeekStart(value) {
  return value === 'sunday' ? 'sunday' : 'monday';
}

export function calendarDateInTimeZone(instant, timeZone = DEFAULT_CALENDAR_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: normalizeCalendarTimeZone(timeZone),
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(get('year'), get('month') - 1, get('day'));
}

export function calendarDateKeyInTimeZone(instant, timeZone = DEFAULT_CALENDAR_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: normalizeCalendarTimeZone(timeZone),
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function calendarTimeInTimeZone(instant, timeZone = DEFAULT_CALENDAR_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: normalizeCalendarTimeZone(timeZone), hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('hour')}:${get('minute')}`;
}

export function calendarDateKeyForValue(value, timeZone = DEFAULT_CALENDAR_TIME_ZONE) {
  const text = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const instant = new Date(text);
  return Number.isNaN(instant.getTime()) ? '' : calendarDateKeyInTimeZone(instant, timeZone);
}

export function startOfCalendarWeek(date, weekStart = 'monday') {
  const offset = normalizeWeekStart(weekStart) === 'sunday'
    ? date.getDay()
    : (date.getDay() + 6) % 7;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - offset);
}

export function calendarWeekdayLabels(locale = 'pt-BR', weekStart = 'monday') {
  const sunday = new Date(Date.UTC(2023, 0, 1));
  const labels = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setUTCDate(date.getUTCDate() + index);
    return new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(date);
  });
  return normalizeWeekStart(weekStart) === 'sunday' ? labels : [...labels.slice(1), labels[0]];
}

export function calendarTimeZoneLabel(instant, locale = 'pt-BR', timeZone = DEFAULT_CALENDAR_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: normalizeCalendarTimeZone(timeZone), timeZoneName: 'short', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  return parts.find((part) => part.type === 'timeZoneName')?.value || normalizeCalendarTimeZone(timeZone);
}
