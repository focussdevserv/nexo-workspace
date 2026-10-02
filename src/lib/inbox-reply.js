function normalizedStatus(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

export function isResolvedInboxConversation(conversation) {
  return ['closed', 'resolved', 'resolvido', 'resolvida'].includes(normalizedStatus(conversation?.status));
}

export function nextInboxConversationStatus(conversation) {
  return isResolvedInboxConversation(conversation) ? 'open' : 'closed';
}

export function canReplyToInboxConversation(channel, conversation) {
  // E-mail metadata is only a workspace label; replying still belongs to the provider thread.
  return channel === 'E-mail' || !isResolvedInboxConversation(conversation);
}
