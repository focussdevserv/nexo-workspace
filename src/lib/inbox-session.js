export function preferredInboxSessionId(conversationSessionId, activeSessions = []) {
  if (!Array.isArray(activeSessions) || activeSessions.length === 0) return '';
  const linked = activeSessions.find((session) => String(session.id) === String(conversationSessionId ?? ''));
  return String(linked?.id ?? activeSessions[0]?.id ?? '');
}
