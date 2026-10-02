import { workspaceStartPages } from './workspace-preferences.js';

const allowedValues = {
  'workspace.timezone': ['America/Sao_Paulo', 'America/Manaus', 'UTC'],
  'workspace.weekStart': ['monday', 'sunday'],
  'preferences.startPage': workspaceStartPages,
  'billing.defaultDueDays': ['1', '3', '7', '15', '30'],
};

export function confirmSettingsImport({ dirty, confirmReplace }) {
  if (!dirty) return true;
  return confirmReplace('HÃ¡ alteraÃ§Ãµes nÃ£o salvas em ConfiguraÃ§Ãµes. Importar este arquivo e substituÃ­-las?');
}

export function normalizeImportedSettings(payload, defaults) {
  if (payload?.version !== 1 || !payload.settings || typeof payload.settings !== 'object' || Array.isArray(payload.settings)) {
    throw new Error('invalid settings export');
  }

  return Object.fromEntries(Object.entries(defaults).map(([group, fallback]) => {
    const candidate = payload.settings[group];
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [group, { ...fallback }];
    const normalized = { ...fallback };
    for (const [field, defaultValue] of Object.entries(fallback)) {
      const value = candidate[field];
      if (typeof value !== typeof defaultValue) continue;
      const allowed = allowedValues[`${group}.${field}`];
      if (!allowed || allowed.includes(value)) normalized[field] = value;
    }
    return [group, normalized];
  }));
}
