const parseFiniteNumber = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return Number.NaN;
  if (String(value).trim() === '') return Number.NaN;
  return Number(value);
};

export function validateWorkspaceSettings(settings = {}) {
  const billing = settings.billing || {};
  const percentFields = [
    ['lateFee', 'Multa por atraso'],
    ['interest', 'Juros ao mês'],
  ];

  for (const [field, label] of percentFields) {
    const value = parseFiniteNumber(billing[field]);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return `${label}: informe um percentual entre 0 e 100.`;
    }
  }

  const reminderText = String(billing.reminderDays ?? '').trim();
  const reminderDays = reminderText.split(',').map((item) => item.trim());
  if (!reminderText || reminderDays.some((item) => !/^-?\d+$/.test(item) || Math.abs(Number(item)) > 365)) {
    return 'Dias para lembretes: informe dias inteiros entre -365 e 365, separados por vírgula.';
  }

  const dueDays = String(billing.defaultDueDays ?? '');
  if (!['1', '3', '7', '15', '30'].includes(dueDays)) {
    return 'Vencimento padrão: selecione um dos prazos disponíveis.';
  }

  return '';
}
