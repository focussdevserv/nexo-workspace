export function buildSiteAssetPayload(draft, client) {
  const name = String(draft?.name || '').trim();
  const rawUrl = String(draft?.url || '').trim();
  if (!name) throw new Error('Informe um nome para o ativo.');
  if (!rawUrl) throw new Error('Informe o dominio ou endereco que sera monitorado.');
  if (!client?.id) throw new Error('Selecione um cliente cadastrado.');
  let url;
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rawUrl) && !/^https?:\/\//i.test(rawUrl)) throw new Error();
    url = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  } catch { throw new Error('Informe um dominio ou URL HTTP/HTTPS valido.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname || (url.port && !['80', '443'].includes(url.port))) {
    throw new Error('Use uma URL HTTP/HTTPS publica, sem credenciais nem porta personalizada.');
  }
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local')) {
    throw new Error('O monitoramento aceita somente dominios publicos.');
  }
  return {
    name,
    url: url.toString(),
    clientId: client.id,
    client: client.name,
    type: draft.type,
    renewalDate: draft.renewalDate || '',
    dnsProvider: String(draft.dnsProvider || '').trim(),
    autoRenew: draft.autoRenew === '' ? null : draft.autoRenew === 'yes',
  };
}

export function siteAssetUrlForEdit(asset = {}) {
  return String(asset.url || asset.domain || '').trim();
}

export function siteMonitorSchedulesForAsset(assetId, schedules = []) {
  if (assetId == null || assetId === '') return [];
  return schedules.filter((schedule) => String(schedule.siteAssetId ?? '') === String(assetId));
}

export function siteMonitorIntervalForAsset(assetId, schedules = [], fallback = 15) {
  const linked = siteMonitorSchedulesForAsset(assetId, schedules);
  const selected = linked.find((schedule) => schedule.enabled === true) || linked[0];
  const interval = Number(selected?.intervalMinutes);
  return Number.isFinite(interval) && interval > 0 ? interval : fallback;
}

export function siteMonitorScheduleState(assetId, schedules = [], selectedMinutes = 15) {
  const linkedSchedules = siteMonitorSchedulesForAsset(assetId, schedules);
  const enabledSchedules = linkedSchedules.filter((schedule) => schedule.enabled === true);
  const interval = Number(selectedMinutes);
  return {
    schedules: linkedSchedules,
    enabledSchedules,
    enabled: enabledSchedules.length > 0,
    intervalNeedsSave: enabledSchedules.some((schedule) => Number(schedule.intervalMinutes || 15) !== interval),
  };
}

export function siteMonitorScheduleControlsDisabled({ loading = false, hasError = false, busyId = '' } = {}) {
  return Boolean(loading || hasError || busyId);
}
