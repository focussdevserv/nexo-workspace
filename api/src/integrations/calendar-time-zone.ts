export const DEFAULT_CALENDAR_TIME_ZONE = 'America/Sao_Paulo';

export function normalizeCalendarTimeZone(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return DEFAULT_CALENDAR_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
    return value;
  } catch {
    return DEFAULT_CALENDAR_TIME_ZONE;
  }
}

export function isValidCalendarTimeZone(value: unknown): value is string {
  return typeof value === 'string' && value.trim() === value && normalizeCalendarTimeZone(value) === value;
}

export function nextCalendarDate(date: string): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export function localDateTimeToIso(date: string, time: string, timeZone: string): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const [hour = 0, minute = 0] = time.split(':').map(Number);
  const wallTime = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wallTime;
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const parts = formatter.formatToParts(new Date(instant));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    const representedWallTime = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    const correction = wallTime - representedWallTime;
    instant += correction;
    if (!correction) break;
  }
  return new Date(instant).toISOString();
}
