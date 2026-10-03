export function summarizeTrackedSeconds(entries = []) {
  return entries.reduce((total, entry) => {
    const seconds = Number(entry?.seconds);
    if (Number.isFinite(seconds) && seconds > 0) return total + Math.round(seconds);
    const hours = Number(entry?.hours);
    return Number.isFinite(hours) && hours > 0 ? total + Math.round(hours * 3600) : total;
  }, 0);
}

export function formatTrackedDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainder = totalSeconds % 60;

  const time = `${hours}h ${String(minutes).padStart(2, '0')}min`;
  return remainder ? `${time} ${remainder}s` : time;
}
