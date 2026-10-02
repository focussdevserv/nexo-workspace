const PAYMENT_TIME_ZONE = 'America/Sao_Paulo';

/** Format provider timestamps using the calendar timezone used by payment due dates. */
export function formatPaymentDate(value) {
  if (!value) return '';
  const source = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(source)) {
    const calendarDate = new Date(`${source}T00:00:00.000Z`);
    if (Number.isNaN(calendarDate.valueOf()) || calendarDate.toISOString().slice(0, 10) !== source) return '';
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(source)
    ? new Date(`${source}T12:00:00-03:00`)
    : new Date(source);
  if (Number.isNaN(date.valueOf())) return '';
  return new Intl.DateTimeFormat('pt-BR', { timeZone: PAYMENT_TIME_ZONE }).format(date);
}
