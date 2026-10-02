import { useEffect, useState } from 'react';

const storageKey = 'nexo.workspace.preferences.v1';
const defaultPreferences = Object.freeze({ compact: false, darkMode: false, showCompleted: false, confirmDelete: true, startPage: 'Meu Dia' });
const startPages = new Set(['Meu Dia', 'Agenda', 'Tarefas', 'CRM', 'Projetos']);

function applyWorkspaceTheme(darkMode) {
  if (typeof document === 'undefined') return;
  const theme = darkMode ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function normalizeWorkspacePreferences(value) {
  const source = value?.preferences && typeof value.preferences === 'object' ? value.preferences : value || {};
  return {
    compact: typeof source.compact === 'boolean' ? source.compact : defaultPreferences.compact,
    darkMode: typeof source.darkMode === 'boolean' ? source.darkMode : defaultPreferences.darkMode,
    showCompleted: typeof source.showCompleted === 'boolean' ? source.showCompleted : defaultPreferences.showCompleted,
    confirmDelete: typeof source.confirmDelete === 'boolean' ? source.confirmDelete : defaultPreferences.confirmDelete,
    startPage: startPages.has(source.startPage) ? source.startPage : defaultPreferences.startPage,
  };
}

export function readCachedWorkspacePreferences() {
  try { return normalizeWorkspacePreferences(JSON.parse(localStorage.getItem(storageKey) || 'null')); }
  catch { return { ...defaultPreferences }; }
}

export function publishWorkspacePreferences(value) {
  const preferences = normalizeWorkspacePreferences(value);
  applyWorkspaceTheme(preferences.darkMode);
  try { localStorage.setItem(storageKey, JSON.stringify(preferences)); } catch { /* Preferences still apply in this tab. */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nexo:workspace-preferences', { detail: preferences }));
  return preferences;
}

export function useWorkspacePreferences() {
  const [preferences, setPreferences] = useState(() => {
    const cached = readCachedWorkspacePreferences();
    applyWorkspaceTheme(cached.darkMode);
    return cached;
  });
  useEffect(() => {
    const update = (event) => {
      const next = normalizeWorkspacePreferences(event.detail);
      applyWorkspaceTheme(next.darkMode);
      setPreferences(next);
    };
    const restore = (event) => {
      if (event.key !== storageKey) return;
      const next = readCachedWorkspacePreferences();
      applyWorkspaceTheme(next.darkMode);
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
