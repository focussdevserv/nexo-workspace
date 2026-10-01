type ClientServiceCharge = {
  serviceId?: unknown; service?: unknown; billingMode?: unknown; amount?: unknown; frequency?: unknown; installments?: unknown;
};

export function validateClientServiceCharges(value: unknown): string | null {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length > 50) return 'A lista de servicos contratados e invalida.';
  const ids = new Set<string>();
  for (const entry of value as ClientServiceCharge[]) {
    if (!entry || typeof entry !== 'object' || typeof entry.service !== 'string' || !entry.service.trim() || entry.service.length > 180) return 'Cada servico precisa ter um nome valido.';
    const mode = entry.billingMode;
    if (!['none', 'single', 'installments', 'recurring'].includes(String(mode))) return 'Escolha uma condicao de cobranca valida para cada servico.';
    if (entry.serviceId != null) {
      const id = String(entry.serviceId);
      if (ids.has(id)) return 'Um servico nao pode ser vinculado duas vezes.';
      ids.add(id);
    }
    if (mode === 'none') continue;
    const amount = Number(entry.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) return 'Informe um valor valido para cada servico cobrado.';
    if (mode === 'installments') {
      const count = Number(entry.installments);
      if (!Number.isInteger(count) || count < 2 || count > 24) return 'Parcelamentos devem ter de 2 a 24 parcelas.';
    }
    if (mode === 'recurring' && !/^(days|months):(1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24)$/.test(String(entry.frequency || ''))) return 'Escolha uma frequencia valida para o servico recorrente.';
  }
  return null;
}
