export function commercialStatusPatch(page, status, contractDocument = '') {
  const patch = {
    status,
    tone: ['Ativo', 'Aprovada', 'Assinado', 'Cliente', 'Fechado'].includes(status) ? 'green' : 'amber',
  };
  if (page === 'contratos') patch.documentText = String(contractDocument || '');
  return patch;
}
