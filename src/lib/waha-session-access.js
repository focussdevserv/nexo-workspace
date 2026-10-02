export function canManageWahaSessions(role) {
  return role === 'owner';
}

export function canShowWahaQr(role, status) {
  return canManageWahaSessions(role) && status === 'SCAN_QR_CODE';
}
