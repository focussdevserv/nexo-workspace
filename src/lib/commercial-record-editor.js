const commercialEditorFields = {
  empresas: [
    { key: 'name', label: 'Empresa', required: true },
    { key: 'segment', label: 'Segmento' },
    { key: 'city', label: 'Cidade' },
    { key: 'size', label: 'Porte' },
  ],
  contatos: [
    { key: 'name', label: 'Nome', required: true },
    { key: 'company', label: 'Empresa' },
    { key: 'role', label: 'Cargo' },
    { key: 'email', label: 'E-mail', type: 'email' },
    { key: 'phone', label: 'Telefone', type: 'tel' },
    { key: 'last', label: 'Último contato' },
  ],
  propostas: [
    { key: 'title', label: 'Título da proposta', required: true },
    { key: 'clientId', label: 'Cliente', type: 'client', required: true },
    { key: 'email', label: 'E-mail do cliente', type: 'email' },
    { key: 'value', label: 'Valor proposto', type: 'currency' },
    { key: 'service', label: 'Serviço' },
    { key: 'deadline', label: 'Prazo' },
    { key: 'paymentTerms', label: 'Condição de pagamento' },
    { key: 'scope', label: 'Escopo', type: 'textarea', wide: true },
  ],
  contratos: [
    { key: 'title', label: 'Título do contrato', required: true },
    { key: 'clientId', label: 'Cliente', type: 'client', required: true },
    { key: 'value', label: 'Valor contratado', type: 'currency' },
    { key: 'service', label: 'Serviço' },
    { key: 'deadline', label: 'Prazo' },
    { key: 'renewal', label: 'Renovação' },
    { key: 'paymentTerms', label: 'Condição de pagamento' },
    { key: 'progress', label: 'Progresso (%)', type: 'number', required: true },
    { key: 'scope', label: 'Escopo', type: 'textarea', wide: true },
  ],
};

export function commercialRecordEditorFields(page) {
  return commercialEditorFields[page] || [];
}

const normalizeName = (value) => String(value || '').trim().toLocaleLowerCase('pt-BR');

export function commercialRecordEditorDraft(page, record = {}, clients = []) {
  return Object.fromEntries(commercialRecordEditorFields(page).map(({ key }) => {
    let value = record[key];
    if (key === 'progress' && value === undefined) value = 0;
    if (key === 'clientId' && !value) {
      const normalizedName = normalizeName(record.client);
      value = clients.find((client) => normalizeName(client.name) === normalizedName)?.id || record.clientId || '';
    }
    return [key, String(value ?? '')];
  }));
}

export function commercialRecordEditorIsDirty(page, record, draft, clients = []) {
  return JSON.stringify(commercialRecordEditorDraft(page, record, clients)) !== JSON.stringify(draft || {});
}

export function buildCommercialRecordEditorPatch(page, draft, clients = [], record = {}, services = []) {
  const fields = commercialRecordEditorFields(page);
  if (!fields.length) return { error: 'Este registro não pode ser editado por este formulário.' };

  const patch = {};
  for (const field of fields) {
    const value = String(draft?.[field.key] ?? '').trim();
    if (field.required && !value) return { error: `Preencha o campo ${field.label.toLocaleLowerCase('pt-BR')}.` };
    if (field.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return { error: 'Informe um e-mail válido.' };
    }
    if (field.type === 'currency' && value && normalizeName(value) !== 'a definir') {
      const currency = value.replace(/^r\$\s*/i, '').trim();
      const validCurrency = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:[,.]\d{1,2})?$/.test(currency);
      if (!validCurrency || !/[1-9]/.test(currency)) return { error: 'Informe um valor válido maior que zero ou deixe “A definir”.' };
    }
    if (field.type === 'number' && value && (!/^\d{1,3}$/.test(value) || Number(value) > 100)) {
      return { error: 'O progresso deve estar entre 0 e 100.' };
    }
    patch[field.key] = field.type === 'number' && value ? Number(value) : value;
  }

  if (['propostas', 'contratos'].includes(page)) {
    const client = clients.find((item) => String(item.id) === String(patch.clientId))
      || (String(record.clientId || '') === String(patch.clientId) ? {
        id: record.clientId, name: record.client, email: record.email,
      } : null);
    if (!client) return { error: 'Selecione um cliente cadastrado.' };
    patch.clientId = client.id;
    patch.client = client.name;
    if (page === 'propostas' || page === 'contratos') patch.name = patch.title;
    if (page === 'propostas' && !patch.email) patch.email = client.email || '';
    if (page === 'contratos') patch.email = client.email || '';
  }

  if (page === 'propostas' && patch.service !== undefined && patch.service !== record.service) {
    const service = services.find((item) => normalizeName(item.name) === normalizeName(patch.service));
    patch.serviceId = service?.id || '';
    patch.serviceIds = service ? [service.id] : [];
  }
  if (page === 'contratos' && patch.service !== undefined && patch.service !== record.service) {
    patch.serviceId = services.find((item) => normalizeName(item.name) === normalizeName(patch.service))?.id || '';
  }

  return { patch };
}
