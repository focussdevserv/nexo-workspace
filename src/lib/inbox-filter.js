import { isResolvedInboxConversation } from './inbox-reply.js';

export function filterInboxConversations(rows, query = '', filter = 'Todas') {
  if (!Array.isArray(rows)) return [];
  const term = String(query || '').trim().toLocaleLowerCase('pt-BR');
  const phoneTerm = term.replace(/\D/g, '');
  return rows.filter((item) => {
    const searchable = `${item.name || ''} ${item.company || ''} ${item.email || ''} ${item.phone || ''} ${item.text || ''} ${item.subject || ''}`.toLocaleLowerCase('pt-BR');
    const phone = String(item.phone || '').replace(/\D/g, '');
    if (term && !searchable.includes(term) && !(phoneTerm.length >= 4 && phone.includes(phoneTerm))) return false;
    if (filter === 'Nao lidas') return Number(item.unread || 0) > 0;
    if (filter === 'Abertas') return !isResolvedInboxConversation(item);
    if (filter === 'Resolvidas') return isResolvedInboxConversation(item);
    return true;
  });
}
