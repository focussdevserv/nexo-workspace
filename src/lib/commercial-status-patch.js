export function commercialStatusPatch(page, status, contractDocument = '', { includeContractDocument = true } = {}) {
  const patch = {
    status,
    tone: ['Ativo', 'Aprovada', 'Assinado', 'Cliente', 'Fechado'].includes(status) ? 'green' : 'amber',
  };
  if (page === 'contratos' && includeContractDocument) patch.documentText = String(contractDocument || '');
  return patch;
}
