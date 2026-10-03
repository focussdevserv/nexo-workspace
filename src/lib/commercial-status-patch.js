export function commercialStatusPatch(page, status, contractDocument = '', { includeContractDocument = true } = {}) {
  // A lead's lifecycle field is `stage` throughout the CRM. Sending it as
  // `status` makes the editor appear to save while leaving the pipeline
  // unchanged, and bypasses the close-and-convert workflow.
  const patch = {
    [page === 'leads' ? 'stage' : 'status']: status,
    tone: ['Ativo', 'Aprovada', 'Assinado', 'Cliente', 'Fechado'].includes(status) ? 'green' : 'amber',
  };
  if (page === 'contratos' && includeContractDocument) patch.documentText = String(contractDocument || '');
  return patch;
}
