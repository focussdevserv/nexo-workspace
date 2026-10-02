export function paymentSupportWarning({ clientError = '', methodsError = '' } = {}) {
  const warnings = [];
  if (clientError) warnings.push('Cobranças carregadas, mas a lista de clientes não ficou disponível. Tente atualizar antes de vincular uma cobrança a um cliente.');
  if (methodsError) warnings.push(`${methodsError} As cobranças existentes continuam disponíveis; configure o Mercado Pago para emitir novas.`);
  return warnings.join(' ');
}
