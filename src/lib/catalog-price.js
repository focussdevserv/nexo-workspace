export function parseCatalogPrice(value) {
  const raw = String(value ?? '').trim().replace(/[^\d.,-]/g, '');
  if (!raw) return 0;

  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  let normalized = raw;
  if (comma >= 0) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (dot >= 0 && raw.length - dot - 1 === 3) {
    normalized = raw.replace(/\./g, '');
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}
