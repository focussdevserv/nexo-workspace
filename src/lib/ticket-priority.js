const priorities = new Set(['Baixa', 'Media', 'Alta', 'Urgente']);

export function normalizeTicketPriority(value) {
  const raw = String(value || '').trim();
  const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  if (normalized === 'normal' || normalized === 'media' || normalized === 'moderada') return 'Media';
  const match = [...priorities].find((priority) => priority.toLocaleLowerCase('pt-BR') === normalized);
  return match || 'Media';
}

export function ticketPriorityLabel(value) {
  const priority = normalizeTicketPriority(value);
  return priority === 'Media' ? 'Média' : priority;
}
