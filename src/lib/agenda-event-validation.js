const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function validateAgendaEvent({ date, time, end, allDay = false } = {}) {
  const match = datePattern.exec(String(date || ''));
  if (!match) return 'Informe uma data válida para o compromisso.';
  const [, year, month, day] = match.map(Number);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));
  if (parsedDate.getUTCFullYear() !== year || parsedDate.getUTCMonth() !== month - 1 || parsedDate.getUTCDate() !== day) {
    return 'Informe uma data válida para o compromisso.';
  }
  if (allDay) return '';
  if (!timePattern.test(String(time || '')) || !timePattern.test(String(end || ''))) return 'Informe o horário de início e término.';
  if (end <= time) return 'O término precisa ser posterior ao início.';
  return '';
}

export function parseAgendaAttendees(value = '') {
  const entries = String(value || '').split(/[;,\s]+/).map((email) => email.trim()).filter(Boolean);
  const attendees = [];
  const invalid = [];
  const seen = new Set();
  for (const email of entries) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      invalid.push(email);
      continue;
    }
    const key = email.toLocaleLowerCase('en-US');
    if (!seen.has(key)) attendees.push(email);
    seen.add(key);
  }
  return { attendees, invalid };
}

export function validateAgendaAttendees(value = '') {
  const { invalid } = parseAgendaAttendees(value);
  return invalid.length ? `Confira os e-mails dos convidados: ${invalid.join(', ')}.` : '';
}
