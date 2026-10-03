const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function parseDisplayAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let raw = String(value ?? '').replace(/[^\d.,-]/g, '');
  if (!raw) return 0;

  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    raw = comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  } else if (comma >= 0) {
    raw = raw.length - comma - 1 <= 2 ? raw.replace(',', '.') : raw.replace(/,/g, '');
  } else if (dot >= 0 && raw.length - dot - 1 > 2) {
    raw = raw.replace(/\./g, '');
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function recurringMonthlyAmount(charge) {
  if (charge?.billingMode !== 'recurring') return 0;
  const amount = parseDisplayAmount(charge.amount);
  const [unit, rawInterval] = String(charge.frequency || 'months:1').split(':');
  const interval = Math.max(Number(rawInterval) || 1, 1);
  if (unit === 'days') return amount * 30 / interval;
  if (unit === 'months') return amount / interval;
  return 0;
}

export function clientMonthlyRevenue(client) {
  if (Array.isArray(client?.serviceCharges)) {
    return client.serviceCharges.reduce((total, charge) => total + recurringMonthlyAmount(charge), 0);
  }
  if (client?.plannedRevenueMonthly != null && client.plannedRevenueMonthly !== '' && Number.isFinite(Number(client.plannedRevenueMonthly))) {
    return Number(client.plannedRevenueMonthly);
  }
  // A converted lead's value is a one-time opportunity estimate, not verified
  // recurring revenue. Keep it on the lead/client record without counting it as MRR.
  if (client?.leadId) return 0;
  return parseDisplayAmount(client?.value);
}

export function clientMonthlyRevenueLabel(client) {
  if (Array.isArray(client?.serviceCharges)) {
    const amount = clientMonthlyRevenue(client);
    return amount > 0 ? `${brl.format(amount)} / mês` : 'Sem recorrência';
  }
  if (client?.plannedRevenueMonthly != null && client.plannedRevenueMonthly !== '' && Number.isFinite(Number(client.plannedRevenueMonthly))) {
    const amount = Number(client.plannedRevenueMonthly);
    return amount > 0 ? `${brl.format(amount)} / mês` : 'Sem recorrência';
  }
  if (client?.leadId) return 'Sem recorrência';
  const amount = clientMonthlyRevenue(client);
  return amount > 0 ? `${brl.format(amount)} / mês` : client?.value || 'A definir';
}
