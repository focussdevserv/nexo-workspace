export function canManageWahaSessions(role) {
  return role === 'owner';
}

export function canShowWahaQr(role, status) {
  return canManageWahaSessions(role) && status === 'SCAN_QR_CODE';
}

export function canOfferWahaConnectAction(status) {
  return ['SCAN_QR_CODE', 'FAILED', 'NOT_FOUND'].includes(status);
}

export function wahaQrSessionMessage(status) {
  if (status === 'STOPPED') return 'Sessão pausada. Use Retomar para continuar a conexão.';
  if (status === 'FAILED') return 'Sessão falhou. Gere um novo QR Code para tentar novamente.';
  if (status === 'STARTING') return 'Iniciando sessão...';
  return 'Aguardando QR Code...';
}
