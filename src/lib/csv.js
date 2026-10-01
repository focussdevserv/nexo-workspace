const sensitiveKey = /token|secret|password/i;

function removeSensitiveFields(value) {
  if (Array.isArray(value)) return value.map(removeSensitiveFields);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !sensitiveKey.test(key))
    .map(([key, nested]) => [key, removeSensitiveFields(nested)]));
}

function csvCell(value) {
  const normalized = removeSensitiveFields(value);
  const text = Array.isArray(normalized)
    ? normalized.map((item) => item && typeof item === 'object' ? JSON.stringify(item) : String(item ?? '')).join(', ')
    : normalized && typeof normalized === 'object' ? JSON.stringify(normalized) : String(normalized ?? '');
  const spreadsheetSafe = /^[\s]*[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${spreadsheetSafe.replaceAll('"', '""')}"`;
}

export function recordsToCsv(records) {
  const safeRecords = records.filter((item) => item && typeof item === 'object' && !Array.isArray(item));
  const columns = [...new Set(safeRecords.flatMap((item) => Object.keys(item).filter((key) => !sensitiveKey.test(key))))];
  return rowsToCsv([columns, ...safeRecords.map((item) => columns.map((key) => item[key]))]);
}

export function rowsToCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(';')).join('\r\n');
}

export function downloadCsvFile(filename, csv) {
  const blobUrl = URL.createObjectURL(new Blob([csv.startsWith('\ufeff') ? csv : `\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
}
