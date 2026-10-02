export function settingsBaseline(defaults, savedSettings) {
  return Object.fromEntries(Object.entries(defaults).map(([group, fallback]) => [
    group,
    { ...fallback, ...(savedSettings?.[group] || {}) },
  ]));
}

export function settingsDraftHasChanges(draft, baseline) {
  return JSON.stringify(draft) !== JSON.stringify(baseline);
}
