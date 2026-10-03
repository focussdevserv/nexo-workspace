/**
 * Resolve legacy commercial rows by their strongest available identifier.
 * Name/title fallbacks are allowed only when unique, so an edit or deletion
 * can never silently affect several id-less records with the same label.
 */
export function commercialRecordTargetMatches(rows = [], target) {
  if (!Array.isArray(rows) || !target || typeof target !== 'object') return [];

  const hasId = target.id !== undefined && target.id !== null && String(target.id).trim() !== '';
  const key = hasId ? target.id : (target.title || target.name);
  if (key === undefined || key === null || String(key).trim() === '') return [];

  return rows.flatMap((row, index) => {
    if (!row || typeof row !== 'object') return [];
    const rowKey = hasId
      ? row.id
      : (row.id !== undefined && row.id !== null && String(row.id).trim() !== '' ? null : (row.title || row.name));
    return String(rowKey ?? '') === String(key) ? [index] : [];
  });
}
