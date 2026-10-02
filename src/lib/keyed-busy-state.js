export function updateKeyedBusyState(current, key, busy) {
  const next = new Set(current);
  const normalizedKey = String(key);
  if (busy) next.add(normalizedKey);
  else next.delete(normalizedKey);
  return next;
}
