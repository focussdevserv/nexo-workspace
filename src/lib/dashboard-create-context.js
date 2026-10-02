const quickCreateActions = new Set(['lead', 'project', 'task', 'event']);

export function dashboardCreateContext(action, intentId) {
  if (!intentId) return null;
  if (action === 'billing') return { action: 'create', intentId };
  return quickCreateActions.has(action) ? { quickCreate: action, intentId } : null;
}
