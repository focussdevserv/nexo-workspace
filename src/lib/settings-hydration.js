import { settingsBaseline } from './settings-draft.js';

export function resolveSettingsHydration({ defaults, savedRecord, loading, error, dirty }) {
  if (loading || error || dirty) return null;
  return {
    settings: settingsBaseline(defaults, savedRecord?.settings),
    savedAt: savedRecord?.savedAt || '',
  };
}
