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
