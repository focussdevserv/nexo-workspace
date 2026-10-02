const demoSession = {
  id: 'demo-waha-session',
  label: 'WhatsApp de demonstração',
  status: 'WORKING',
  number: 'Número simulado',
  engine: 'Focusshub Demo',
  demo: true,
};

export function handleLocalDemoInboxRequest(store, pathname, method, body = {}, now = new Date()) {
  if (pathname === '/api/integrations/status' && method === 'GET') {
    return {
      changed: false,
      response: { data: [{ name: 'WAHA', provider: 'waha', configured: true, enabled: true, demo: true }] },
    };
  }

  if (pathname === '/api/integrations/waha/sessions' && method === 'GET') {
    return { changed: false, response: { data: [{ ...demoSession }] } };
  }

  if (pathname !== '/api/integrations/waha/send' || method !== 'POST') return null;
  if (body.sessionId !== demoSession.id) throw new Error('Selecione a sessão WhatsApp simulada. Nenhuma mensagem foi enviada.');

  const conversationId = String(body.conversationId || '');
  const text = String(body.text || '').trim();
  const attachment = body.attachment && typeof body.attachment.filename === 'string' ? body.attachment.filename : '';
  if (!conversationId || (!text && !attachment) || text.length > 10_000) throw new Error('Informe uma conversa e uma mensagem válida para a simulação.');

  const rows = Array.isArray(store.inbox) ? store.inbox : [];
  const existing = rows.find((item) => String(item.id) === conversationId);
  if (!existing) throw new Error('Conversa não encontrada na demonstração local.');
  if (['closed', 'resolved', 'resolvido', 'resolvida'].includes(String(existing.status || '').toLocaleLowerCase('pt-BR'))) {
    throw new Error('Reabra o atendimento antes de responder.');
  }

  const sentAt = now.toISOString();
  const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const entry = {
    clientMessageId: String(body.clientMessageId || `demo-message-${now.getTime()}`),
    side: 'sent',
    text,
    ...(attachment ? { attachment } : {}),
    time,
    sentAt,
    simulated: true,
    demoTag: 'SIMULAÇÃO LOCAL · NADA ENVIADO AO WHATSAPP',
  };
  store.inbox = rows.map((item) => String(item.id) === conversationId ? {
    ...item,
    text: text || `Anexo: ${attachment}`,
    time,
    unread: 0,
    history: [...(Array.isArray(item.history) ? item.history : []), entry].slice(-100),
    updatedAt: sentAt,
    demoTag: 'DEMONSTRAÇÃO LOCAL · SEM AÇÃO EXTERNA',
  } : item);

  return {
    changed: true,
    response: { data: { messageId: entry.clientMessageId, conversationId, simulated: true, demoTag: entry.demoTag } },
  };
}
