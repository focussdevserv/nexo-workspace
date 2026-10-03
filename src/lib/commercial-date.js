function calendarDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

/** Extracts real calendar dates from ISO, Brazilian, or labeled renewal text. */
export function parseCommercialDate(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const iso = text.match(/(?:^|\D)(\d{4})-(\d{2})-(\d{2})(?:$|\D)/);
  if (iso) return calendarDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const brazilian = text.match(/(?:^|\D)(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:$|\D)/);
  if (brazilian) return calendarDate(Number(brazilian[3]), Number(brazilian[2]), Number(brazilian[1]));
  return null;
}

function utcDay(date) {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isCommercialDateWithinNextDays(value, days = 30, now = new Date()) {
  const target = parseCommercialDate(value);
  const limitDays = Number(days);
  if (!target || !Number.isInteger(limitDays) || limitDays < 0 || !(now instanceof Date) || Number.isNaN(now.getTime())) return false;
  const delta = (target.getTime() - utcDay(now)) / 86_400_000;
  return delta >= 0 && delta <= limitDays;
}
