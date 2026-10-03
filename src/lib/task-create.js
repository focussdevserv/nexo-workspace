export function buildTaskRecord({ id, title, project, projectId, client, clientId, due, assignee, priority, recurrence, description } = {}) {
  return {
    id,
    title: String(title || '').trim(),
    project: String(project || 'Sem projeto'),
    projectId: projectId || '',
    client: String(client || 'Sem cliente'),
    clientId: clientId || '',
    due: String(due || 'A definir'),
    assignee: String(assignee || '').trim(),
    status: 'A fazer',
    state: 'A fazer',
    priority: priority || 'Normal',
    recurrence: recurrence || 'Nao recorrente',
    recurrenceSequence: 1,
    description: String(description || '').trim(),
  };
}
