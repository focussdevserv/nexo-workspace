const WORKSPACE_TIME_ZONE = 'America/Sao_Paulo';

function workspaceCalendarDate(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: WORKSPACE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** Date input values must follow the same São Paulo calendar the billing API validates. */
export function paymentDateAfterDays(days, base = new Date()) {
  const calendarDate = workspaceCalendarDate(base);
  const result = new Date(`${calendarDate}T00:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + Number(days || 0));
  return result.toISOString().slice(0, 10);
}
