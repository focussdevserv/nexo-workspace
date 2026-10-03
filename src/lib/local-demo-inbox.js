const demoSession = {
  id: 'demo-waha-session',
  label: 'WhatsApp de demonstração',
  status: 'WORKING',
  number: 'Número simulado',
  engine: 'Focusshub Demo',
  demo: true,
};

function demoSessions(store) {
  if (Array.isArray(store.wahaSessions)) return store.wahaSessions;
  return [{ ...demoSession, ...(store.wahaSession || {}) }];
}

export function handleLocalDemoInboxRequest(store, pathname, method, body = {}, now = new Date()) {
  if (pathname === '/api/integrations/status' && method === 'GET') {
    const providers = [
      ['Mercado Pago', 'mercadopago'], ['Evolution API', 'evolution'], ['WAHA', 'waha'], ['Resend', 'resend'],
      ['Hostinger E-mail', 'hostinger'], ['Google Workspace', 'google'], ['Clicksign', 'clicksign'],
      ['GitHub', 'github'], ['n8n', 'n8n'], ['Sentry', 'sentry'],
    ];
    return {
      changed: false,
      response: { data: providers.map(([name, provider]) => ({
        name, provider, configured: provider === 'waha', enabled: provider === 'waha', demo: true,
        ...(provider === 'waha' ? { lastTestStatus: 'demo', lastTestMessage: 'Sessão simulada; nenhuma conta WhatsApp foi conectada.' } : {}),
      })) },
    };
  }

  if (pathname === '/api/integrations/waha/sessions' && method === 'GET') {
    return { changed: false, response: { data: demoSessions(store) } };
  }

  if (pathname === '/api/integrations/waha/sessions' && method === 'POST') {
    const label = String(body.label || '').trim();
    if (label.length < 2 || label.length > 80) throw new Error('Informe um nome entre 2 e 80 caracteres.');
    const id = `demo-waha-${globalThis.crypto?.randomUUID?.() || Date.now()}`;
    const session = { ...demoSession, id, label, status: 'SCAN_QR_CODE', demo: true };
    store.wahaSessions = [...demoSessions(store), session];
    return { changed: true, response: { data: session } };
  }

  const sessionQr = pathname.match(/^\/api\/integrations\/waha\/sessions\/([^/]+)\/qr$/);
  if (sessionQr && method === 'GET') {
    const id = decodeURIComponent(sessionQr[1]);
    if (!demoSessions(store).some((item) => item.id === id)) throw new Error('Sessão não encontrada na demonstração local.');
    return { changed: false, response: { data: { demo: true, image: '', message: 'QR Code real indisponível na demonstração local.' }, status: 'demo_only' } };
  }

  const sessionAction = pathname.match(/^\/api\/integrations\/waha\/sessions\/([^/]+)\/(stop|start|restart|logout)$/);
  if (sessionAction && method === 'POST') {
    const [, encodedSessionId, action] = sessionAction;
    const sessionId = decodeURIComponent(encodedSessionId);
    const sessions = demoSessions(store);
    if (!sessions.some((item) => item.id === sessionId)) throw new Error('Sessao de demonstracao nao encontrada.');
    const status = action === 'stop' ? 'STOPPED' : action === 'logout' ? 'SCAN_QR_CODE' : 'WORKING';
    store.wahaSessions = sessions.map((item) => item.id === sessionId ? { ...item, status } : item);
    return { changed: true, response: { data: store.wahaSessions.find((item) => item.id === sessionId) } };
  }

  const sessionDelete = pathname.match(/^\/api\/integrations\/waha\/sessions\/([^/]+)$/);
  if (sessionDelete && method === 'DELETE') {
    const id = decodeURIComponent(sessionDelete[1]);
    const sessions = demoSessions(store);
    if (!sessions.some((item) => item.id === id)) throw new Error('Sessao de demonstracao nao encontrada.');
    store.wahaSessions = sessions.filter((item) => item.id !== id);
    return { changed: true, response: { data: { deleted: true, simulated: true } } };
  }

  if (pathname !== '/api/integrations/waha/send' || method !== 'POST') return null;
  const session = demoSessions(store).find((item) => item.id === body.sessionId);
  if (!session?.demo || session.status !== 'WORKING') throw new Error('Selecione uma sessão WhatsApp simulada ativa. Nenhuma mensagem foi enviada.');
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
