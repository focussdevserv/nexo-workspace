export function buildServiceProject(service, client, projectId = Date.now()) {
  if (!service?.name || !client?.id || !client?.name) throw new Error('Selecione um cliente cadastrado antes de criar o projeto.');
  const project = {
    id: projectId,
    name: service.name,
    client: client.name,
    clientId: client.id,
    type: service.category || 'Serviço',
    service: service.name,
    scope: service.description || '',
    status: 'Em andamento',
    progress: 0,
    due: service.duration || 'A definir',
    team: service.responsible ? [service.responsible] : [],
    tone: service.color || 'blue',
  };
  const checklist = service.templateTasks?.length
    ? service.templateTasks
    : [`Briefing de ${service.name}`, 'Alinhar escopo com o cliente', 'Executar e revisar entrega', 'Aprovação final', 'Entregar ao cliente'];
  const tasks = checklist.map((title, index) => ({
    id: projectId + index + 1,
    title,
    project: project.name,
    projectId: project.id,
    client: client.name,
    clientId: client.id,
    due: project.due,
    assignee: service.responsible || '',
    status: 'A fazer',
    priority: index === 0 ? 'Alta' : 'Normal',
  }));
  return { project, tasks };
}
