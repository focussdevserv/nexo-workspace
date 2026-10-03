import { useEffect, useState } from 'react';
import { DEFAULT_CALENDAR_TIME_ZONE, normalizeCalendarTimeZone, normalizeWeekStart } from './calendar-preferences.js';

const storageKey = 'nexo.workspace.preferences.v1';
const themePreferenceKey = 'nexo.workspace.theme-preference.v1';
const defaultPreferences = Object.freeze({ compact: false, darkMode: false, showCompleted: false, confirmDelete: true, startPage: 'Meu Dia', timezone: DEFAULT_CALENDAR_TIME_ZONE, weekStart: 'monday', language: 'pt-BR', currency: 'BRL', dateFormat: 'dd/MM/yyyy' });
// Keep this list aligned with the app's navigable modules. A saved start page
// must survive normalization, otherwise the preference silently falls back.
export const workspaceStartPages = Object.freeze([
  'Meu Dia', 'Agenda', 'Tarefas', 'Caixa de entrada', 'Aprovações',
  'CRM', 'Leads', 'Pipeline', 'Clientes', 'Empresas', 'Contatos', 'Propostas', 'Serviços', 'Contratos',
  'Projetos', 'Horas', 'Arquivos', 'WhatsApp', 'Tickets', 'Sites', 'Domínios', 'Hospedagens',
  'Repositórios', 'Monitoramento', 'Financeiro', 'Receitas', 'Despesas', 'Contas', 'Cobranças',
  'Assinaturas', 'Portal do cliente', 'Equipe', 'Automações', 'Integrações', 'Relatórios', 'Metas', 'Configurações',
]);
const startPages = new Set(workspaceStartPages);

export function workspaceColorScheme(darkMode) {
  return darkMode ? 'dark' : 'only light';
}

export function applyWorkspaceTheme(darkMode) {
  if (typeof document === 'undefined') return;
  const theme = darkMode ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  // `only light` opts out of Chromium's forced darkening when the user chose
  // the light theme, while preserving native dark controls in dark mode.
  const colorScheme = workspaceColorScheme(darkMode);
  document.documentElement.style.colorScheme = colorScheme;
  const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (colorSchemeMeta) colorSchemeMeta.content = colorScheme;
}

export function normalizeWorkspacePreferences(value) {
  const source = value?.preferences && typeof value.preferences === 'object' ? value.preferences : value || {};
  return {
    compact: typeof source.compact === 'boolean' ? source.compact : defaultPreferences.compact,
    darkMode: typeof source.darkMode === 'boolean' ? source.darkMode : defaultPreferences.darkMode,
    showCompleted: typeof source.showCompleted === 'boolean' ? source.showCompleted : defaultPreferences.showCompleted,
    confirmDelete: typeof source.confirmDelete === 'boolean' ? source.confirmDelete : defaultPreferences.confirmDelete,
    startPage: startPages.has(source.startPage) ? source.startPage : defaultPreferences.startPage,
    timezone: normalizeCalendarTimeZone(source.timezone),
    weekStart: normalizeWeekStart(source.weekStart),
    language: normalizeWorkspaceLocale(source.language),
    currency: normalizeWorkspaceCurrency(source.currency),
    dateFormat: normalizeWorkspaceDateFormat(source.dateFormat),
  };
}

export function applyWorkspaceLocale(language) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = normalizeWorkspaceLocale(language);
}

export const supportedWorkspaceLocales = Object.freeze(['pt-BR', 'en-US', 'es-ES']);
export const supportedWorkspaceCurrencies = Object.freeze(['BRL', 'USD', 'EUR']);
export const supportedWorkspaceDateFormats = Object.freeze(['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd']);

export function normalizeWorkspaceLocale(value) {
  return supportedWorkspaceLocales.includes(value) ? value : defaultPreferences.language;
}

export function normalizeWorkspaceCurrency(value) {
  return supportedWorkspaceCurrencies.includes(value) ? value : defaultPreferences.currency;
}

export function normalizeWorkspaceDateFormat(value) {
  return supportedWorkspaceDateFormats.includes(value) ? value : defaultPreferences.dateFormat;
}

export function workspacePreferencesFromSettings(settings) {
  return {
    ...(settings?.preferences || {}),
    timezone: settings?.workspace?.timezone,
    weekStart: settings?.workspace?.weekStart,
    language: settings?.workspace?.language,
    currency: settings?.workspace?.currency,
    dateFormat: settings?.workspace?.dateFormat,
  };
}

export function readCachedWorkspacePreferences() {
  try { return normalizeWorkspacePreferences(JSON.parse(localStorage.getItem(storageKey) || 'null')); }
  catch { return { ...defaultPreferences }; }
}

export function confirmWorkspaceDelete(message, preferences = readCachedWorkspacePreferences(), confirmAction = (value) => typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(value) : true) {
  if (preferences?.confirmDelete === false) return true;
  return confirmAction(message);
}

export function rememberWorkspaceThemePreference(darkMode) {
  try { localStorage.setItem(themePreferenceKey, darkMode ? 'dark' : 'light'); } catch { /* The active tab can still use the selected theme. */ }
}

export function mergeServerWorkspacePreferences(value) {
  const preferences = normalizeWorkspacePreferences(value);
  try {
    const localTheme = localStorage.getItem(themePreferenceKey);
    if (localTheme === 'dark' || localTheme === 'light') preferences.darkMode = localTheme === 'dark';
  } catch { /* Fall back to the server preference when local storage is unavailable. */ }
  return preferences;
}

export function publishWorkspacePreferences(value) {
  const preferences = normalizeWorkspacePreferences(value);
  applyWorkspaceTheme(preferences.darkMode);
  applyWorkspaceLocale(preferences.language);
  try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch { /* Preferences still apply in this tab. */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nexo:workspace-preferences', { detail: preferences }));
  return preferences;
}

export function useWorkspacePreferences() {
  const [preferences, setPreferences] = useState(() => {
    const cached = readCachedWorkspacePreferences();
    applyWorkspaceTheme(cached.darkMode);
    applyWorkspaceLocale(cached.language);
    return cached;
  });
  useEffect(() => {
    const update = (event) => {
      const next = normalizeWorkspacePreferences(event.detail);
      applyWorkspaceTheme(next.darkMode);
      applyWorkspaceLocale(next.language);
      setPreferences(next);
    };
    const restore = (event) => {
      if (event.key !== storageKey) return;
      const next = readCachedWorkspacePreferences();
      applyWorkspaceTheme(next.darkMode);
      applyWorkspaceLocale(next.language);
      setPreferences(next);
    };
    window.addEventListener('nexo:workspace-preferences', update);
    window.addEventListener('storage', restore);
    return () => {
      window.removeEventListener('nexo:workspace-preferences', update);
      window.removeEventListener('storage', restore);
    };
  }, []);
  return preferences;
}
