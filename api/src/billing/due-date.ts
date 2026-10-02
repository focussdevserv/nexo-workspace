const saoPauloDate = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export function paymentDueDateDuration(dueDate: string, now = new Date()): { days: number; duration: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const parsed = new Date(`${dueDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== dueDate) return null;
  const today = saoPauloDate(now);
  const days = Math.round((parsed.valueOf() - Date.parse(`${today}T00:00:00.000Z`)) / 86_400_000);
  if (days < 1 || days > 30) return null;
  return { days, duration: `P${days}D` };
}

/** Keep the requested calendar deadline when the payment provider omits its expiration timestamp. */
export function paymentDueDateAtEndOfDay(dueDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const parsed = new Date(`${dueDate}T23:59:59-03:00`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) !== dueDate) return null;
  return parsed;
}
