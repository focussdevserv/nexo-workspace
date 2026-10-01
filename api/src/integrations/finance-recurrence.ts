export type FinanceRecurrenceFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const frequencyMonths: Record<FinanceRecurrenceFrequency, number | null> = {
  weekly: null,
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

function parseDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('finance_recurrence_invalid_date');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('finance_recurrence_invalid_date');
  return date;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addMonthsFromAnchor(anchor: Date, months: number): Date {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth() + months;
  const targetYear = year + Math.floor(month / 12);
  const targetMonth = ((month % 12) + 12) % 12;
  const day = Math.min(anchor.getUTCDate(), new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate());
  return new Date(Date.UTC(targetYear, targetMonth, day));
}

export function buildFinanceRecurrenceDates(
  startDate: string,
  dueDate: string | null | undefined,
  frequency: FinanceRecurrenceFrequency,
  count: number,
): Array<{ date: string; dueDate: string | null }> {
  if (!Number.isInteger(count) || count < 2 || count > 60) throw new Error('finance_recurrence_invalid_count');
  const anchor = parseDate(startDate);
  const dueAnchor = dueDate ? parseDate(dueDate) : null;
  const dueOffset = dueAnchor ? Math.round((dueAnchor.getTime() - anchor.getTime()) / 86_400_000) : null;
  const monthStep = frequencyMonths[frequency];
  return Array.from({ length: count }, (_, index) => {
    const date = monthStep === null
      ? new Date(anchor.getTime() + index * 7 * 86_400_000)
      : addMonthsFromAnchor(anchor, index * monthStep);
    const due = dueOffset === null ? null : new Date(date.getTime() + dueOffset * 86_400_000);
    return { date: formatDate(date), dueDate: due ? formatDate(due) : null };
  });
}
