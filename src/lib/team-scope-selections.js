const idsIn = (value) => new Set((Array.isArray(value) ? value : []).map(String));

/** Lists selected client/project IDs that no longer exist in the loaded workspace directories. */
export function missingTeamScopeSelections(scope, clients, projects) {
  if (!Array.isArray(clients) || !Array.isArray(projects)) return { clientIds: [], projectIds: [] };
  const clientIds = idsIn(scope?.clientIds);
  const projectIds = idsIn(scope?.projectIds);
  const availableClientIds = new Set(clients.map((item) => String(item?.id)));
  const availableProjectIds = new Set(projects.map((item) => String(item?.id)));

  return {
    clientIds: [...clientIds].filter((id) => !availableClientIds.has(id)),
    projectIds: [...projectIds].filter((id) => !availableProjectIds.has(id)),
  };
}

/** Remove only explicitly identified stale selections, preserving every valid scope ID. */
export function removeMissingTeamScopeSelections(scope, missing) {
  const missingClients = idsIn(missing?.clientIds);
  const missingProjects = idsIn(missing?.projectIds);
  return {
    ...(scope || {}),
    clientIds: (Array.isArray(scope?.clientIds) ? scope.clientIds : []).filter((id) => !missingClients.has(String(id))),
    projectIds: (Array.isArray(scope?.projectIds) ? scope.projectIds : []).filter((id) => !missingProjects.has(String(id))),
  };
}
