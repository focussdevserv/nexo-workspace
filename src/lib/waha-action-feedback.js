export function wahaActionFeedback(action, { statusConfirmed = true, localDemo = false } = {}) {
  if (!statusConfirmed) {
    return localDemo
      ? 'A simulação aceitou a ação, mas o estado local não foi confirmado. Atualize para conferir.'
      : 'A WAHA aceitou a ação, mas o status não foi confirmado. Atualize as sessões antes de repetir.';
  }

  const prefix = localDemo ? 'Simulação local: ' : '';
  if (action === 'stop') return `${prefix}sessão pausada; o vínculo do celular foi preservado.`;
  if (action === 'logout') return `${prefix}WhatsApp desconectado. Leia o novo QR para vincular novamente.`;
  return `${prefix}sessão atualizada.`;
}
