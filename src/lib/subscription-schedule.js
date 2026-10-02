const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value) {
  if (!DATE_PATTERN.test(String(value || ''))) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function minimumSubscriptionEndDate(startDate) {
  if (!validDate(startDate)) return '';
  const nextDay = new Date(`${startDate}T00:00:00.000Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return nextDay.toISOString().slice(0, 10);
}

/** Build Mercado Pago schedule timestamps using the workspace's São Paulo calendar dates. */
export function buildSubscriptionSchedule(startDate, endDate = '') {
  if (!validDate(startDate)) throw new Error('subscription_start_date_invalid');
  if (endDate && (!validDate(endDate) || endDate <= startDate)) throw new Error('subscription_end_date_invalid');
  return {
    startAt: `${startDate}T09:00:00-03:00`,
    ...(endDate ? { endAt: `${endDate}T23:59:59-03:00` } : {}),
  };
}
