export function permissionDraftForAccount(account, moduleKeys) {
  const existing = account?.permissions || {};
  const modules = Object.fromEntries(moduleKeys.map((key) => {
    const access = existing[key];
    return [key, access && typeof access === 'object'
      ? { read: Boolean(access.read), write: Boolean(access.write), delete: Boolean(access.delete) }
      : null];
  }));
  const scope = existing.scope || {};
  return {
    ...modules,
    scope: {
      mode: scope.mode === 'selected' ? 'selected' : 'all',
      clientIds: Array.isArray(scope.clientIds) ? [...scope.clientIds] : [],
      projectIds: Array.isArray(scope.projectIds) ? [...scope.projectIds] : [],
    },
  };
}

// These values mirror the ordinary workspace access baseline enforced by the
// API. They are presentation/editing defaults only; the API remains the source
// of truth and continues to protect owner-only integration controls.
const memberModuleDefaults = {
  crm: { read: null, write: false, delete: false },
  delivery: { read: true, write: true, delete: null },
  support: { read: true, write: true, delete: null },
  finance: { read: false, write: false, delete: false },
  sites: { read: false, write: false, delete: false },
  automations: { read: false, write: false, delete: false },
  integrations: { read: null, write: null, delete: false },
  settings: { read: true, write: false, delete: false },
  reports: { read: false, write: false, delete: false },
};

export function inheritedModulePermissions(role, moduleKey) {
  if (role === 'admin') return { read: true, write: true, delete: true };
  return { ...(memberModuleDefaults[moduleKey] || { read: false, write: false, delete: false }) };
}

export function effectiveModulePermissionDraft(draft, role, moduleKey) {
  const override = draft?.[moduleKey];
  return override && typeof override === 'object'
    ? { read: Boolean(override.read), write: Boolean(override.write), delete: Boolean(override.delete) }
    : inheritedModulePermissions(role, moduleKey);
}

export function setModulePermissionValue(draft, role, moduleKey, permission, value) {
  const current = effectiveModulePermissionDraft(draft, role, moduleKey);
  const next = Object.fromEntries(Object.entries(current).map(([key, currentValue]) => [key, currentValue === true]));
  next[permission] = Boolean(value);
  if (permission === 'read' && !value) {
    next.write = false;
    next.delete = false;
  }
  if ((permission === 'write' || permission === 'delete') && value) next.read = true;
  return { ...draft, [moduleKey]: next };
}

export function permissionsPayload(draft, moduleKeys) {
  return Object.fromEntries([
    ...moduleKeys.filter((key) => draft?.[key] && typeof draft[key] === 'object')
      .map((key) => [key, { read: Boolean(draft[key].read), write: Boolean(draft[key].write), delete: Boolean(draft[key].delete) }]),
    ['scope', {
      mode: draft?.scope?.mode === 'selected' ? 'selected' : 'all',
      clientIds: Array.isArray(draft?.scope?.clientIds) ? [...draft.scope.clientIds] : [],
      projectIds: Array.isArray(draft?.scope?.projectIds) ? [...draft.scope.projectIds] : [],
    }],
  ]);
}

export function setModulePermissionMode(draft, moduleKey, mode) {
  return {
    ...draft,
    [moduleKey]: mode === 'blocked' ? { read: false, write: false, delete: false } : null,
  };
}

export function validatePermissionDraft(draft, moduleKeys) {
  if (moduleKeys.some((key) => draft?.[key] && (draft[key].write || draft[key].delete) && !draft[key].read)) {
    return 'Permissões de edição ou exclusão precisam incluir leitura no mesmo módulo.';
  }
  if (draft?.scope?.mode === 'selected' && !draft.scope.clientIds?.length && !draft.scope.projectIds?.length) {
    return 'Selecione ao menos um cliente ou projeto antes de salvar este escopo.';
  }
  return '';
}
