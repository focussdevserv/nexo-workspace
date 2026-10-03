const terminalTaskStates = new Set(['concluida', 'concluido', 'cancelada', 'cancelado', 'completed', 'done', 'archived']);
const terminalLeadStages = new Set(['fechado', 'perdido', 'won', 'lost']);

function normalized(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
}

export function isTerminalLeadStage(stage) {
  return terminalLeadStages.has(normalized(stage));
}

export function findOpenLeadFollowUpTask(tasks = [], leadId) {
  if (leadId === undefined || leadId === null || leadId === '') return null;
  return tasks.find((task) => {
    // Some older/manual tasks carry an empty sourceLeadId alongside a valid
    // leadId. Nullish coalescing treats the empty string as authoritative and
    // misses the existing task, causing the CRM retry to create a duplicate.
    const linkedLeadId = [task?.sourceLeadId, task?.leadId]
      .find((value) => value !== undefined && value !== null && String(value).trim() !== '');
    const states = [normalized(task?.state), normalized(task?.status)].filter(Boolean);
    return String(linkedLeadId ?? '') === String(leadId) && !states.some((state) => terminalTaskStates.has(state));
  }) || null;
}

export function buildLeadFollowUpTaskData(lead, { action, due, existingTask } = {}) {
  const title = String(action ?? '').trim();
  const deadline = String(due ?? '').trim();
  if (!lead?.id) throw new Error('Salve o lead antes de agendar uma tarefa.');
  if (isTerminalLeadStage(lead.stage)) throw new Error('Leads fechados ou perdidos não recebem novas tarefas de acompanhamento.');
  if (!title) throw new Error('Informe a próxima ação antes de agendá-la.');
  if (!deadline) throw new Error('Escolha a data para a próxima ação.');

  return {
    ...(existingTask || {}),
    title,
    detail: `Próxima ação do lead ${lead.name || lead.title || ''}`.trim(),
    due: deadline,
    status: existingTask?.status || existingTask?.state || 'A fazer',
    state: existingTask?.state || existingTask?.status || 'A fazer',
    priority: existingTask?.priority || 'Alta',
    assignee: lead.owner || existingTask?.assignee || '',
    client: lead.company || existingTask?.client || 'Sem cliente',
    clientId: lead.clientId || existingTask?.clientId || '',
    sourceLeadId: String(lead.id),
    automationKey: 'lead-follow-up-manual',
  };
}
