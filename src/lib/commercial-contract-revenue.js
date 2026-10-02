import { parseDisplayAmount, recurringMonthlyAmount } from './client-billing-summary.js';

const activeStatuses = new Set(['ativo', 'assinado', 'active', 'signed']);
const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');

export function activeContractMonthlyRevenue(contracts = []) {
  return contracts.reduce((total, contract) => {
    if (!activeStatuses.has(normalize(contract.status))) return total;
    const terms = [contract.paymentTerms, contract.cadence, contract.billingMode].filter(Boolean).join(' ');
    if (!/mensal|recorr/i.test(normalize(terms))) return total;
    const frequency = String(contract.frequency || 'months');
    const interval = Number(contract.frequencyInterval || contract.interval || 1) || 1;
    return total + recurringMonthlyAmount({
      billingMode: 'recurring',
      amount: parseDisplayAmount(contract.value),
      frequency: `${frequency}:${interval}`,
    });
  }, 0);
}
