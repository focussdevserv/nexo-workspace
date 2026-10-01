import { splitInstallmentAmounts } from './installment-plan.js';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function cadenceLabel(frequency) {
  const [unit, rawCount] = String(frequency || 'months:1').split(':');
  const count = Math.max(1, Number(rawCount) || 1);
  if (unit === 'days' && count === 7) return 'Semanal';
  const months = { 1: 'Mensal', 3: 'Trimestral', 6: 'Semestral', 12: 'Anual' };
  return unit === 'months' ? months[count] || `A cada ${count} meses` : `A cada ${count} dias`;
}

export function summarizeClientServices(client) {
  const charges = Array.isArray(client?.serviceCharges) ? client.serviceCharges : [];
  const chargedNames = new Set();
  const rows = charges.map((charge, index) => {
    const name = String(charge?.service || charge?.name || '').trim();
    if (name) chargedNames.add(name.toLocaleLowerCase('pt-BR'));
    const mode = charge?.billingMode || 'none';
    const amount = Number(charge?.amount);
    const installments = Math.max(2, Number(charge?.installments) || 2);
    const installmentIndex = Math.max(0, Number(charge?.generatedInstallments) || 0);
    const installmentAmounts = mode === 'installments' ? splitInstallmentAmounts(amount, installments) : [];
    let cadence = 'Preço a definir';
    if (mode === 'single') cadence = 'Cobrança única';
    if (mode === 'installments') cadence = `${Math.max(2, Number(charge.installments) || 2)} parcelas`;
    if (mode === 'recurring') cadence = `Recorrência ${cadenceLabel(charge.frequency)}`;
    return {
      key: `${name || 'serviço'}-${index}`,
      name: name || 'Serviço contratado',
      amount: mode !== 'none' && Number.isFinite(amount) && amount > 0 ? currency.format(amount) : 'A definir',
      cadence: mode === 'installments' ? `${installments} parcelas · ${installmentIndex >= installments ? 'concluído' : `próxima ${installmentIndex + 1}/${installments}`}` : cadence,
      billingMode: mode,
      amountToCharge: mode === 'installments' ? installmentAmounts[installmentIndex] : amount,
      installmentIndex,
      installmentCount: installments,
      serviceId: charge?.serviceId,
      frequency: String(charge?.frequency || 'months:1'),
    };
  });
  const names = Array.isArray(client?.services) ? client.services : [];
  for (const [index, rawName] of names.entries()) {
    const name = String(rawName || '').trim();
    if (!name || chargedNames.has(name.toLocaleLowerCase('pt-BR'))) continue;
    rows.push({ key: `service-${index}-${name}`, name, amount: 'A definir', cadence: 'Condição conforme contrato', billingMode: 'none' });
  }
  return rows;
}
