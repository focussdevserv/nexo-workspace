export function notificationNavigationTarget(item = {}) {
  if (item.taskId || item.entityType === 'tasks') {
    const taskId = item.taskId || item.entityId;
    return { page: 'Tarefas', context: taskId ? { taskId: String(taskId) } : null };
  }
  if (item.entityType === 'events') {
    return { page: 'Agenda', context: item.entityId ? { eventId: String(item.entityId) } : null };
  }
  if (item.entityType === 'clients' || item.entityType === 'client') {
    return { page: 'Clientes', context: item.entityId ? { clientId: String(item.entityId) } : null };
  }
  return { page: item.page || 'Meu Dia', context: item.context || null };
}
