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

/** Persist a monitor schedule in the browser-only demo store without contacting a provider. */
export function configureLocalDemoSiteSchedule(store, assetId, configuration, now = new Date()) {
  const id = String(assetId ?? '');
  if (!id || !(store['site-assets'] || []).some((asset) => String(asset.id) === id)) {
    throw new Error('Ativo não encontrado na demonstração local.');
  }
  const { enabled, intervalMinutes } = configuration || {};
  if (typeof enabled !== 'boolean' || ![5, 15, 30, 60].includes(Number(intervalMinutes))) {
    throw new Error('Informe um intervalo válido para o monitoramento.');
  }
  const monitors = Array.isArray(store.monitors) ? store.monitors : [];
  const linked = monitors.filter((monitor) => String(monitor.siteAssetId ?? '') === id);
  const canonical = linked.find((monitor) => monitor.enabled === true) || linked[0];
  const savedAt = now.toISOString();
  const schedule = {
    ...canonical,
    id: canonical?.id || `demo-site-monitor-${id}`,
    siteAssetId: id,
    name: String(store['site-assets'].find((asset) => String(asset.id) === id)?.name || ''),
    intervalMinutes: Number(intervalMinutes),
    enabled,
    nextCheckAt: enabled ? new Date(now.getTime() + Number(intervalMinutes) * 60_000).toISOString() : null,
    updatedAt: savedAt,
    demoTag: 'DEMONSTRAÇÃO LOCAL · SEM CONSULTA EXTERNA',
  };
  store.monitors = [schedule, ...monitors.filter((monitor) => String(monitor.siteAssetId ?? '') !== id)];
  return { siteAssetId: id, schedules: [schedule], enabled, intervalMinutes: Number(intervalMinutes) };
}

export function removeLocalDemoSiteAsset(store, assetId) {
  const id = String(assetId ?? '');
  if (!id) return false;
  const assets = Array.isArray(store['site-assets']) ? store['site-assets'] : [];
  if (!assets.some((asset) => String(asset.id) === id)) return false;
  store['site-assets'] = assets.filter((asset) => String(asset.id) !== id);
  const monitors = Array.isArray(store.monitors) ? store.monitors : [];
  store.monitors = monitors.filter((monitor) => String(monitor.siteAssetId ?? '') !== id);
  // The demo store is persisted in browser storage. Remove the per-asset
  // history too, so deleting an asset cannot leave inaccessible stale records.
  if (store.siteMonitorHistory && typeof store.siteMonitorHistory === 'object') {
    const history = { ...store.siteMonitorHistory };
    delete history[id];
    store.siteMonitorHistory = history;
  }
  return true;
}
