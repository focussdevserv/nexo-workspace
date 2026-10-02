export function hoursEntryDurationInput(entry) {
  const seconds = Number(entry?.seconds);
  if (Number.isFinite(seconds) && seconds > 0) return (seconds / 3600).toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
  const hours = Number(entry?.hours);
  return Number.isFinite(hours) && hours > 0 ? hours.toFixed(2) : '';
}

export function updateHoursEntryDuration(entry, durationHours) {
  const hours = Number(durationHours);
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new RangeError('A duração precisa ser maior que zero.');
  }

  const seconds = Math.round(hours * 3600);
  const startedAt = new Date(entry?.startedAt || '');
  const endedAt = Number.isNaN(startedAt.getTime())
    ? entry?.endedAt
    : new Date(startedAt.getTime() + seconds * 1000).toISOString();

  return {
    ...entry,
    hours: Number((seconds / 3600).toFixed(2)),
    seconds,
    ...(endedAt ? { endedAt } : {}),
  };
}
