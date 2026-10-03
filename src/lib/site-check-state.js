export function beginSiteCheck(pending, assetId) {
  const id = String(assetId || '');
  if (!id || pending.has(id)) return false;
  pending.add(id);
  return true;
}

export function finishSiteCheck(pending, assetId) {
  pending.delete(String(assetId || ''));
  return new Set(pending);
}

export function siteCheckFailureMessage(code) {
  if (code === 'host_not_public') return 'O endereço precisa ser público; IPs privados e locais não podem ser verificados.';
  if (code === 'invalid_url') return 'Informe um domínio ou URL HTTP/HTTPS válido.';
  return 'Não foi possível consultar o domínio. Confira o endereço e tente novamente.';
}
