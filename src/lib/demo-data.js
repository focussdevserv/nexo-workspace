const fictitiousMarkers = [
  'example.invalid', 'exemplo', 'vidamais', 'novaera', 'doce ponto',
  'studio movimento', 'orbe café', 'orbe cafe', 'estúdio horizonte',
  'estudio horizonte', 'grupo aurora', 'ateliê horizonte', 'atelie horizonte',
  'atelie aurora', 'nexo.agency', 'nexo-agencia', 'nexo-agência',
  'nexo.agencia', 'nexo agência', 'clínica vida', 'clinica vida',
  'studiomovimento.com.br', 'doceponto.com.br', '00000-0000',
  '00.000.000/0000-00', 'endereço de demonstração', 'endereco de demonstracao',
  'dados de demonstração', 'dados de demonstracao', 'simulação local',
  'simulacao local', 'deploy simulado', 'exemplo.com.br',
];

const demoGoalIds = new Set(['revenue', 'leads', 'projects']);
const demoTeamIds = new Set(['gs', 'am', 'lc', 'rn']);
const demoRepoNames = new Set(['vidamais-site', 'novaera-landing']);
const demoPortalIds = new Set(['clinica-vidamais', 'novaera-imoveis', 'doce-ponto']);

export function isFictitiousRecord(value, key = '') {
  if (!value || typeof value !== 'object') return false;
  if (key === 'nexo.workspace.goals.v1' && demoGoalIds.has(String(value.id))) return true;
  if (key === 'nexo.workspace.team.v1' && demoTeamIds.has(String(value.id))) return true;
  if (key === 'nexo.repositories.v1' && demoRepoNames.has(String(value.name).toLowerCase())) return true;
  if (key === 'nexo.commercial.records.v1' && value.icon && !value.id) return true;
  if (key.startsWith('nexo.portal.') && demoPortalIds.has(String(value.clientId || value.id))) return true;
  const text = JSON.stringify(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return fictitiousMarkers.some((marker) => text.includes(marker.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
}

export function cleanFictitiousArray(value, key = '') {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => !isFictitiousRecord(item, key));
}

export function cleanFictitiousObject(value, key = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([entryKey, entryValue]) => {
    if (Array.isArray(entryValue)) return [[entryKey, cleanFictitiousArray(entryValue, key)]];
    if (entryValue && typeof entryValue === 'object') {
      if (isFictitiousRecord(entryValue, key)) return [];
      return [[entryKey, cleanFictitiousObject(entryValue, key)]];
    }
    return [[entryKey, entryValue]];
  }));
}

export function purgeFictitiousLocalData() {
  if (typeof window === 'undefined') return;
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (!key?.startsWith('nexo.')) continue;
    try {
      const value = JSON.parse(window.localStorage.getItem(key) || 'null');
      if (Array.isArray(value)) window.localStorage.setItem(key, JSON.stringify(cleanFictitiousArray(value, key)));
      else if (value && typeof value === 'object') window.localStorage.setItem(key, JSON.stringify(cleanFictitiousObject(value, key)));
      else if (key === 'nexo.timer.running' || key === 'nexo.timer.seconds') window.localStorage.removeItem(key);
    } catch {
      // Preserve unknown local values; each screen handles its own malformed state.
    }
  }
}

export function readCleanArray(key, fallback = []) {
  try { return cleanFictitiousArray(JSON.parse(window.localStorage.getItem(key) || 'null') ?? fallback, key); }
  catch { return fallback; }
}

export function readCleanObject(key, fallback = {}) {
  try { return cleanFictitiousObject(JSON.parse(window.localStorage.getItem(key) || 'null') ?? fallback, key); }
  catch { return fallback; }
}
