const projectTemplates = Object.freeze({
  blank: { label: 'Sem modelo', tasks: [] },
  website: { label: 'Site institucional', tasks: ['Briefing e objetivos', 'Estrutura e conteúdo', 'Design das páginas', 'Desenvolvimento', 'Revisão em celular', 'Publicação e entrega'] },
  branding: { label: 'Identidade visual', tasks: ['Briefing e referências', 'Direção criativa', 'Criação da identidade', 'Aplicações da marca', 'Apresentação ao cliente', 'Entrega dos arquivos'] },
  campaign: { label: 'Campanha', tasks: ['Definir público e objetivo', 'Criar peças e textos', 'Configurar canais', 'Revisar com o cliente', 'Publicar campanha', 'Analisar resultados'] },
});

export function projectTemplateChoices() {
  return Object.entries(projectTemplates).map(([value, template]) => ({ value, label: template.label, taskCount: template.tasks.length }));
}

export function buildProjectTemplateTasks(templateId, project, makeId = () => globalThis.crypto?.randomUUID?.() || `project-task-${Date.now()}-${Math.random()}`) {
  const template = projectTemplates[templateId] || projectTemplates.blank;
  const assignee = Array.isArray(project?.team) ? project.team.find(Boolean) || '' : '';
  return template.tasks.map((title, index) => ({
    id: makeId(index, title), title, project: project?.name || 'Projeto', projectId: project?.id || '',
    client: project?.client || 'Sem cliente', clientId: project?.clientId || '',
    due: 'A definir', assignee, status: 'A fazer', state: 'A fazer', priority: 'Normal',
    recurrence: 'Nao recorrente', recurrenceSequence: 1, description: '', templateOrder: index + 1,
  }));
}
