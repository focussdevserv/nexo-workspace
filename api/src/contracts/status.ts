const externallyVerifiedStatuses = new Set(['Aguardando assinatura', 'Assinado', 'Ativo']);

export function requiresExternalSignature(status: unknown) {
  return externallyVerifiedStatuses.has(String(status ?? ''));
}

export function isUnverifiedContractTransition(previousStatus: unknown, nextStatus: unknown) {
  return String(previousStatus ?? '') !== String(nextStatus ?? '') && requiresExternalSignature(nextStatus);
}
