export function paymentFrequencyLabel(frequency, interval) {
  const value = Number(interval);
  if (!Number.isInteger(value) || value < 1) return 'Frequência não informada';
  if (frequency === 'days') return value === 7 ? 'Semanal' : `A cada ${value} dias`;
  if (frequency === 'months') {
    const known = { 1: 'Mensal', 3: 'Trimestral', 6: 'Semestral', 12: 'Anual' };
    return known[value] || `A cada ${value} meses`;
  }
  return 'Frequência não informada';
}
