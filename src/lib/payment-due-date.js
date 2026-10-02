export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateAfterDays(days, base = new Date()) {
  const result = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  result.setDate(result.getDate() + Number(days || 0));
  return localDateString(result);
}
