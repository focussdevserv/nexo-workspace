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
  // The server monitor currently pins DNS resolution to public IPv4 addresses.
  // Reject IPv6 literals at entry instead of saving a target that can never be checked.
  if (url.hostname.includes(':')) {
    throw new Error('O monitoramento ainda aceita enderecos IPv4 publicos, nao enderecos IPv6 diretos.');
  }
  if (isNonPublicHost(url.hostname)) {
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

function isNonPublicHost(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host.includes(':')) {
    return host === '::' || host === '::1' || /^(?:fc|fd|ff)/.test(host) || /^fe[89ab]/.test(host);
  }
  // URL.hostname is already canonicalized by the URL parser, including legacy
  // shorthand IPv4 forms such as 127.1.
  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && c === 0)
    || (a === 192 && b === 0 && c === 2)
    || (a === 192 && b === 88 && c === 99)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113);
}

export function siteMonitorScheduleControlsDisabled({ loading = false, hasError = false, busyId = '' } = {}) {
  return Boolean(loading || hasError || busyId);
}
