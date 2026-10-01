export function classifyWahaQrResponse(status: number, contentType = ''): 'pending' | 'error' | 'image' {
  if ([204, 404, 422].includes(status)) return 'pending';
  if (status < 200 || status >= 300) return 'error';
  return contentType.split(';')[0]?.trim().toLowerCase().startsWith('image/') ? 'image' : 'pending';
}

export function classifyWahaSessionReadiness(sessions: Array<{ status?: unknown }>) {
  const states = sessions.map((session) => String(session.status ?? '').toUpperCase());
  const working = states.filter((status) => status === 'WORKING').length;
  const qrPending = states.filter((status) => status === 'SCAN_QR_CODE').length;
  if (working > 0) return { status: 'connected' as const, working, qrPending, message: `WAHA respondeu; ${working} sessão(ões) WhatsApp pareada(s) e ativa(s).` };
  if (qrPending > 0) return { status: 'setup_required' as const, working, qrPending, message: `WAHA responde, mas ${qrPending} sessão(ões) aguardam leitura do QR pelo telefone.` };
  if (states.length > 0) return { status: 'setup_required' as const, working, qrPending, message: `WAHA responde, mas nenhuma sessão está ativa (${[...new Set(states)].join(', ')}). Retome ou gere um novo QR no app.` };
  return { status: 'setup_required' as const, working, qrPending, message: 'WAHA responde, mas ainda não há uma sessão WhatsApp cadastrada neste workspace.' };
}

export function buildWahaSendFilePayload(input: { session: string; chatId: string; filename: string; mimeType: string; data: string; caption?: string }) {
  if (!input.session || !/^[\w.+-]+@(?:c\.us|g\.us|lid|s\.whatsapp\.net|newsletter)$/.test(input.chatId)) throw new Error('waha_file_invalid');
  if (!input.filename.trim() || input.filename.length > 255 || /[\r\n\0]/.test(input.filename) || !input.data) throw new Error('waha_file_invalid');
  const mimetype = /^[A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+$/.test(input.mimeType) ? input.mimeType.toLowerCase() : 'application/octet-stream';
  return {
    session: input.session,
    chatId: input.chatId,
    file: { mimetype, filename: input.filename, data: input.data },
    ...(input.caption?.trim() ? { caption: input.caption.trim() } : {}),
  };
}
