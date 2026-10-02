export function nextInboxFollowUpDate(now = new Date()) {
  const date = new Date(now);
  if (Number.isNaN(date.valueOf())) return '';
  date.setDate(date.getDate() + 1);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function buildInboxFollowUpTask(conversation, { client = null, assignee = '', due = '' } = {}) {
  const name = String(conversation?.name || conversation?.company || 'contato').trim();
  const linkedClientName = String(client?.name || client?.title || conversation?.company || '').trim();
  return {
    title: `Retornar para ${name}`,
    project: 'Atendimento',
    client: linkedClientName,
    clientId: client?.id == null ? '' : String(client.id),
    due: String(due || '').trim(),
    assignee: String(assignee || '').trim(),
    status: 'A fazer',
    priority: 'Normal',
    sourceConversationId: String(conversation?.id ?? ''),
    sourceChannel: String(conversation?.channel || ''),
  };
}
