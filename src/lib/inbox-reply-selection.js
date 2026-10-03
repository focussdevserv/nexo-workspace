export function inboxReplySelectionKey(channel, conversationId) {
  return conversationId ? `${String(channel || '')}:${String(conversationId)}` : '';
}

export function shouldClearInboxReplyComposer(previousKey, nextKey) {
  return String(previousKey || '') !== String(nextKey || '');
}
