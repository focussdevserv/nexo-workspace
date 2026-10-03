const dashboardWidgets = Object.freeze(['summary', 'leads', 'tasks', 'inbox', 'agenda', 'alerts']);
const defaultDashboardLayout = Object.freeze(Object.fromEntries(dashboardWidgets.map((widget) => [widget, true])));

export function dashboardLayoutStorageKey(userId) {
  return `focusshub.dashboard-layout.v1.${encodeURIComponent(String(userId || 'anonymous'))}`;
}

export function normalizeDashboardLayout(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...defaultDashboardLayout };
  return Object.fromEntries(dashboardWidgets.map((widget) => [widget, typeof value[widget] === 'boolean' ? value[widget] : true]));
}

export function readDashboardLayout(storage, key) {
  try {
    const value = JSON.parse(storage?.getItem(key) || 'null');
    return normalizeDashboardLayout(value);
  } catch {
    return { ...defaultDashboardLayout };
  }
}

export function writeDashboardLayout(storage, key, value) {
  const normalized = normalizeDashboardLayout(value);
  try {
    storage?.setItem(key, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
  }
}

export { dashboardWidgets, defaultDashboardLayout };
