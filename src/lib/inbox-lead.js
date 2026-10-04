import { findLeadDuplicateMatch } from './lead-identity.js';

export function canCreateInboxLead(user, localDemo = false) {
  if (localDemo) return true;
  if (user?.role === 'owner') return true;
  const crm = user?.permissions?.crm;
  return (user?.role === 'admin' && !crm) || (crm?.read === true && crm?.write === true);
}

export function buildInboxLeadDraft(conversation, channel) {
  const email = String(conversation?.email || conversation?.from || conversation?.address || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';
  const phone = String(conversation?.phone || conversation?.telephone || conversation?.whatsappChatId || '').replace(/@.+$/, '');
  const origin = channel === 'E-mail' ? (conversation?.provider === 'hostinger' ? 'Hostinger' : 'Gmail') : 'WhatsApp';
  const threadId = channel === 'E-mail' ? String(conversation?.threadId || conversation?.id || '') : '';
  return {
    name: String(conversation?.name || conversation?.company || '').trim(),
    company: String(conversation?.company || '').trim(),
    email,
    phone,
    source: origin,
    stage: 'Novo lead',
    service: 'A definir',
    value: 'A definir',
    notes: `Origem: ${origin} · conversa ${String(conversation?.id ?? '')}${threadId ? ` · thread ${threadId}` : ''}`,
    sourceChannel: channel === 'E-mail' ? origin : 'WhatsApp',
    sourceConversationId: String(conversation?.id ?? ''),
    sourceThreadId: threadId,
  };
}

export function createInboxLeadOnce(lock, { user, localDemo = false, conversation, channel, draft, records = [], create }) {
  if (!canCreateInboxLead(user, localDemo)) return Promise.resolve({ kind: 'denied' });
  if (!lock?.run || typeof create !== 'function') return Promise.resolve({ kind: 'unavailable' });
  return lock.run(async () => {
    const candidate = { ...draft, name: String(draft?.name || '').trim(), email: String(draft?.email || '').trim(), phone: String(draft?.phone || '').trim() };
    const duplicate = findLeadDuplicateMatch(records, candidate);
    if (duplicate.kind === 'match') return { kind: 'duplicate', record: duplicate.record };
    if (duplicate.kind === 'ambiguous') return { kind: 'duplicate' };
    if (!candidate.name) return { kind: 'invalid' };
    const payload = { ...candidate, title: candidate.name, source: candidate.source || buildInboxLeadDraft(conversation, channel).source };
    try {
      return { kind: 'created', record: await create(payload) };
    } catch (error) {
      if (error?.code === 'duplicate_lead') return { kind: 'duplicate', record: error.details?.duplicateId ? { id: error.details.duplicateId } : null };
      throw error;
    }
  });
}
