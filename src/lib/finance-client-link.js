export function resolveFinanceClientLink(clientId, clients, loading, counterparty = '') {
  const requestedId = String(clientId || '').trim();
  if (!requestedId) return { clientId: null, counterparty: String(counterparty || '').trim() };
  if (loading) return { error: 'Aguarde a lista de clientes carregar antes de salvar o vinculo.' };

  const client = (Array.isArray(clients) ? clients : []).find((item) => String(item.id) === requestedId);
  if (!client) return { error: 'O cliente selecionado nao esta disponivel. Atualize a lista e escolha novamente.' };
  return { clientId: client.id, counterparty: String(counterparty || client.name || '').trim() };
}
