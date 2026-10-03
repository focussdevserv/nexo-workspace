const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function zonedDateTime(year, month, day, hour, minute, timeZone) {
  if (!timeZone) return new Date(year, month - 1, day, hour, minute);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant))
      .filter((part) => part.type !== 'literal')
      .map(({ type, value }) => [type, Number(value)]));
    instant += target - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  }
  const resolved = new Date(instant);
  const parts = Object.fromEntries(formatter.formatToParts(resolved)
    .filter((part) => part.type !== 'literal')
    .map(({ type, value }) => [type, Number(value)]));
  return parts.year === year && parts.month === month && parts.day === day && parts.hour === hour && parts.minute === minute
    ? resolved
    : new Date(Number.NaN);
}

export function buildManualHoursInterval(date, startTime, endTime, now = new Date(), timeZone = '') {
  const match = datePattern.exec(String(date || ''));
  if (!match || !timePattern.test(String(startTime || '')) || !timePattern.test(String(endTime || ''))) {
    return { error: 'Informe uma data e horários válidos.' };
  }

  const [, year, month, day] = match.map(Number);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) {
    return { error: 'Informe uma data válida.' };
  }
  const start = zonedDateTime(year, month, day, Number(startTime.slice(0, 2)), Number(startTime.slice(3, 5)), timeZone);
  if (Number.isNaN(start.getTime())) return { error: 'O horário de início não existe neste fuso horário.' };

  const end = zonedDateTime(year, month, day, Number(endTime.slice(0, 2)), Number(endTime.slice(3, 5)), timeZone);
  if (Number.isNaN(end.getTime())) return { error: 'O horário informado não existe neste fuso horário.' };
  if (endTime === startTime) return { error: 'O início e o término não podem ser iguais.' };
  if (end <= start) {
    const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
    const nextEnd = zonedDateTime(nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate(), Number(endTime.slice(0, 2)), Number(endTime.slice(3, 5)), timeZone);
    end.setTime(nextEnd.getTime());
  }

  if (end.getTime() > now.getTime()) {
    return { error: 'O término do registro não pode estar no futuro.' };
  }

  const seconds = Math.round((end.getTime() - start.getTime()) / 1000);
  if (!Number.isFinite(seconds) || seconds <= 0) return { error: 'Informe um intervalo de horas válido.' };
  return { startedAt: start.toISOString(), endedAt: end.toISOString(), seconds };
}
