export function splitInstallmentAmounts(total, count) {
  const cents = Math.round(Number(total) * 100);
  const parts = Number(count);
  if (!Number.isSafeInteger(cents) || cents < 1 || !Number.isInteger(parts) || parts < 2 || parts > 24) return [];
  const base = Math.floor(cents / parts);
  const remainder = cents % parts;
  return Array.from({ length: parts }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100);
}
