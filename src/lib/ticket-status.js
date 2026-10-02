const statuses = ['Aberto', 'Em andamento', 'Aguardando cliente', 'Resolvido'];

function normalizeStatusText(value) {
  return String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

export function normalizeTicketStatus(value) {
  const normalized = normalizeStatusText(value);
  const aliases = new Map([
    ['aberto', 'Aberto'], ['open', 'Aberto'], ['new', 'Aberto'],
    ['em andamento', 'Em andamento'], ['andamento', 'Em andamento'], ['in progress', 'Em andamento'], ['working', 'Em andamento'],
    ['aguardando cliente', 'Aguardando cliente'], ['aguardando o cliente', 'Aguardando cliente'], ['waiting for customer', 'Aguardando cliente'], ['waiting customer', 'Aguardando cliente'],
    ['resolvido', 'Resolvido'], ['concluido', 'Resolvido'], ['fechado', 'Resolvido'], ['closed', 'Resolvido'], ['resolved', 'Resolvido'], ['done', 'Resolvido'],
  ]);
  return aliases.get(normalized) || String(value || '').trim();
}

export function ticketStatusOptions(currentValue) {
  const current = normalizeTicketStatus(currentValue);
  return statuses.includes(current) ? statuses : [current, ...statuses].filter(Boolean);
}
