const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/;

const validDate = (value) => {
  if (!value) return '';
  const match = String(value).match(dateOnly);
  if (match) {
    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day), 12);
    if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return '';
    return String(value);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

export function clientRelationshipHistoryDateLabel(value) {
  const match = String(value || '').match(dateOnly);
  if (match) {
    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day), 12);
    return date.toLocaleDateString('pt-BR');
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleString('pt-BR');
}

const recordDate = (record, fields) => {
  for (const field of fields) {
    const date = validDate(record?.[field]);
    if (date) return date;
  }
  return '';
};

/** Combine client-facing records into one newest-first relationship timeline. */
export function buildClientRelationshipHistory({
  notes = [], events = [], finance = [], projects = [], tasks = [], tickets = [],
  approvals = [], contracts = [], files = [],
} = {}) {
  const rows = [];
  const add = (kind, records, map) => {
    for (const [index, record] of (Array.isArray(records) ? records : []).entries()) {
      const item = map(record || {});
      if (!item.date || !item.title) continue;
      rows.push({ id: `${kind}:${record?.id ?? index}`, kind, ...item });
    }
  };

  add('Nota', notes, (item) => ({ date: recordDate(item, ['at', 'createdAt']), title: item.text, detail: 'Nota registrada' }));
  add('Atividade', events, (item) => ({ date: recordDate(item, ['at', 'createdAt', 'updatedAt']), title: item.title || item.type || 'Atividade registrada', detail: 'Evento do workspace' }));
  add('Financeiro', finance, (item) => ({
    date: recordDate(item, ['date', 'paidAt', 'settledAt', 'updatedAt', 'createdAt']),
    title: `${item.kind || 'Movimentação'}: ${item.description || 'Registro financeiro'}`,
    detail: item.status || 'Status não informado',
    amount: Number.isFinite(Number(item.amount)) ? Number(item.amount) : null,
    tone: 'green',
  }));
  add('Projeto', projects, (item) => ({ date: recordDate(item, ['updatedAt', 'createdAt', 'startDate']), title: item.name || item.title || 'Projeto', detail: `Projeto · ${item.status || 'Em andamento'}` }));
  add('Tarefa', tasks, (item) => ({ date: recordDate(item, ['completedAt', 'updatedAt', 'createdAt', 'dueDate']), title: item.title || item.name || 'Tarefa', detail: `Tarefa · ${item.status || 'Pendente'}` }));
  add('Ticket', tickets, (item) => ({ date: recordDate(item, ['updatedAt', 'createdAt']), title: `${item.code || 'Ticket'} · ${item.title || item.name || 'Solicitação'}`, detail: `Suporte · ${item.status || 'Aberto'}` }));
  add('Aprovação', approvals, (item) => ({ date: recordDate(item, ['decidedAt', 'updatedAt', 'sentAt', 'createdAt']), title: item.title || item.name || 'Aprovação', detail: `Aprovação · ${item.status || 'Pendente'}` }));
  add('Contrato', contracts, (item) => ({ date: recordDate(item, ['updatedAt', 'createdAt']), title: item.title || item.name || 'Contrato', detail: `Contrato · ${item.status || 'Rascunho'}` }));
  add('Arquivo', files, (item) => ({ date: recordDate(item, ['updatedAt', 'createdAt', 'date']), title: item.name || item.title || 'Arquivo', detail: `Arquivo${item.project ? ` · ${item.project}` : ' do cliente'}` }));

  return rows.sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
}
