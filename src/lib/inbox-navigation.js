export function normalizeInboxChannel(channel) {
  const value = String(channel ?? '').trim().toLocaleLowerCase('pt-BR');
  if (['email', 'e-mail', 'gmail', 'hostinger', 'hostinger e-mail'].includes(value)) return 'E-mail';
  if (['whatsapp', 'wa', 'waha'].includes(value)) return 'WhatsApp';
  return '';
}

export function resolveInboxConversationNavigation(context, conversations, activeChannel, loading) {
  if (!context?.conversationId) return { status: 'none' };

  const channel = normalizeInboxChannel(context.channel) || normalizeInboxChannel(activeChannel) || 'WhatsApp';
  if (channel !== activeChannel || loading) return { status: 'pending', channel };

  const conversationId = String(context.conversationId);
  const conversation = conversations.find((item) => [item.id, item.conversationId, item.threadId]
    .some((candidate) => candidate != null && String(candidate) === conversationId));

  return conversation
    ? { status: 'found', channel, conversation }
    : { status: 'not_found', channel };
}
