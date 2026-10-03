export function checkLocalDemoSite(store, assetId, now = new Date()) {
  const assets = Array.isArray(store['site-assets']) ? store['site-assets'] : [];
  const index = assets.findIndex((item) => String(item.id) === String(assetId));
  if (index < 0) throw new Error('Ativo não encontrado na demonstração local.');

  const existing = assets[index];
  const checkedAt = now.toISOString();
  const data = {
    ...existing,
    health: 'Online',
    status: 'Online',
    httpStatus: 200,
    latencyMs: 120,
    sslExpiresAt: null,
    checkedAt,
    demo: true,
    demoTag: 'VERIFICAÇÃO SIMULADA · SEM CONSULTA EXTERNA',
  };
  store['site-assets'] = assets.map((item, itemIndex) => itemIndex === index ? data : item);

  const history = store.siteMonitorHistory && typeof store.siteMonitorHistory === 'object' ? store.siteMonitorHistory : {};
  const entries = Array.isArray(history[assetId]) ? history[assetId] : [];
  history[assetId] = [{
    id: `demo-check-${assetId}-${now.getTime()}`,
    createdAt: checkedAt,
    payload: { status: 'Online', httpStatus: 200, latencyMs: 120, checkedAt, source: 'manual', simulated: true },
  }, ...entries].slice(0, 50);
  store.siteMonitorHistory = history;
  return data;
}

export function getLocalDemoSiteHistory(store, assetId) {
  const exists = (store['site-assets'] || []).some((item) => String(item.id) === String(assetId));
  if (!exists) throw new Error('Ativo não encontrado na demonstração local.');
  const history = store.siteMonitorHistory?.[assetId];
  return Array.isArray(history) ? history.slice(0, 50) : [];
}

export function removeLocalDemoSiteAsset(store, assetId) {
  const id = String(assetId ?? '');
  if (!id) return false;
  const assets = Array.isArray(store['site-assets']) ? store['site-assets'] : [];
  if (!assets.some((asset) => String(asset.id) === id)) return false;
  store['site-assets'] = assets.filter((asset) => String(asset.id) !== id);
  const monitors = Array.isArray(store.monitors) ? store.monitors : [];
  store.monitors = monitors.filter((monitor) => String(monitor.siteAssetId ?? '') !== id);
  return true;
}
