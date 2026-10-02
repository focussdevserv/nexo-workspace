const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function buildManualHoursInterval(date, startTime, endTime) {
  const match = datePattern.exec(String(date || ''));
  if (!match || !timePattern.test(String(startTime || '')) || !timePattern.test(String(endTime || ''))) {
    return { error: 'Informe uma data e horários válidos.' };
  }

  const [, year, month, day] = match.map(Number);
  const start = new Date(year, month - 1, day, Number(startTime.slice(0, 2)), Number(startTime.slice(3, 5)));
  if (start.getFullYear() !== year || start.getMonth() !== month - 1 || start.getDate() !== day) {
    return { error: 'Informe uma data válida.' };
  }

  const end = new Date(year, month - 1, day, Number(endTime.slice(0, 2)), Number(endTime.slice(3, 5)));
  if (endTime === startTime) return { error: 'O início e o término não podem ser iguais.' };
  if (end <= start) end.setDate(end.getDate() + 1);

  const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds <= 0) return { error: 'Informe um intervalo de horas válido.' };
  return { startedAt: start.toISOString(), endedAt: end.toISOString(), seconds };
}
