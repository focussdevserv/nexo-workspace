export function beginSiteCheck(pending, assetId) {
  const id = String(assetId || '');
  if (!id || pending.has(id)) return false;
  pending.add(id);
  return true;
}

export function finishSiteCheck(pending, assetId) {
  pending.delete(String(assetId || ''));
  return new Set(pending);
}
