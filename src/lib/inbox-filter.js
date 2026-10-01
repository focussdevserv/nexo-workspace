export function filterInboxConversations(rows, query = '', filter = 'Todas') {
  if (!Array.isArray(rows)) return [];
  const term = String(query || '').trim().toLocaleLowerCase('pt-BR');
  return rows.filter((item) => {
    const searchable = `${item.name || ''} ${item.company || ''} ${item.text || ''} ${item.subject || ''}`.toLocaleLowerCase('pt-BR');
    if (term && !searchable.includes(term)) return false;
    if (filter === 'Nao lidas') return Number(item.unread || 0) > 0;
    if (filter === 'Abertas') return item.status !== 'closed';
    if (filter === 'Resolvidas') return item.status === 'closed';
    return true;
  });
}
