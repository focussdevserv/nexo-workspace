export function agendaTimeSlotLabel(date, hour, locale = 'pt-BR') {
  const slotDate = date instanceof Date ? date : new Date(date);
  const normalizedHour = String(hour || '').trim();
  if (Number.isNaN(slotDate.getTime()) || !/^\d{2}:00$/.test(normalizedHour)) {
    return 'Criar compromisso';
  }

  const dateLabel = slotDate.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return `Criar compromisso em ${dateLabel} às ${normalizedHour}`;
}
