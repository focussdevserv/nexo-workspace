function clientName(client) {
  return String(client?.name || client?.title || '').trim().toLocaleLowerCase('pt-BR');
}

export function findProjectClient(project, clients = []) {
  if (!project) return null;
  const clientId = String(project.clientId || '').trim();
  if (clientId) return clients.find((client) => String(client.id) === clientId) || null;

  const name = String(project.client || '').trim().toLocaleLowerCase('pt-BR');
  if (!name || name === 'sem cliente') return null;
  const matches = clients.filter((client) => clientName(client) === name);
  return matches.length === 1 ? matches[0] : null;
}

