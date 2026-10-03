import { matchConversationClient } from './conversation-client-match.js';

export function emptyInboxComposerDraft() {
  return { name: '', company: '', phone: '', email: '', subject: '', body: '', clientId: '' };
}

/** Return the persisted canonical link for a WhatsApp draft, if uniquely known. */
export function inboxConversationClientId(draft, clients = [], contacts = []) {
  const client = matchConversationClient(clients, contacts, draft || {});
  return client?.id == null ? '' : String(client.id);
}
