import { findLeadDuplicateMatch } from './lead-identity.js';
import { checkLocalDemoSite, getLocalDemoSiteHistory, removeLocalDemoSiteAsset } from './local-demo-monitoring.js';
import { proposalAcceptanceState } from './proposal-acceptance-state.js';
import { handleLocalDemoInboxRequest } from './local-demo-inbox.js';

const STORAGE_KEY = 'focusshub.local-demo.v1';
const ENABLED_KEY = 'focusshub.local-demo.enabled';

export function formatLocalDemoCurrency(amount) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(amount) || 0);
}

export function migrateLegacyDemoContractValue(record, seededRecord) {
  if (!record?.demo || !seededRecord?.demo || String(record.id) !== String(seededRecord.id)) return record;
  const seededAmount = Number(String(seededRecord.value || '').replace(/[^\d,]/g, '').replace(',', '.'));
  if (!Number.isFinite(seededAmount)) return record;
  return record.value === `R$ ${seededAmount.toFixed(0)},00` ? { ...record, value: seededRecord.value } : record;
}

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const shiftDate = (days) => {
  const date = new Date(); date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const row = (id, data) => ({ id: `demo-${id}`, ...data, demo: true });

export function isLocalDemoRequested() {
  return import.meta.env?.DEV === true && typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname) && new URLSearchParams(window.location.search).get('demo') === '1';
}

export function isLocalDemoActive() {
  // Explicit opt-in stored by this origin enables a production-safe preview.
  // Demo API calls are intercepted in the browser and never reach the workspace.
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined' && localStorage.getItem(ENABLED_KEY) === 'true';
}

function buildSeed() {
  const clients = [
    ['aurora', 'Aurora Café', 'Café e gastronomia', 'Marina Costa', 'marina@aurora.local'],
    ['vertice', 'Vértice Arquitetura', 'Arquitetura', 'Rafael Mendes', 'rafael@vertice.local'],
    ['flora', 'Flora Bem-Estar', 'Saúde e bem-estar', 'Camila Rocha', 'camila@flora.local'],
    ['norte', 'Norte Solar', 'Energia renovável', 'André Lima', 'andre@nortesolar.local'],
    ['livre', 'Livre & Leve', 'Moda', 'Bianca Alves', 'bianca@livre.local'],
    ['atlas', 'Atlas Contabilidade', 'Serviços profissionais', 'Pedro Nunes', 'pedro@atlas.local'],
    ['brisa', 'Brisa Imóveis', 'Imobiliário', 'Fernanda Reis', 'fernanda@brisa.local'],
    ['cubo', 'Cubo Educação', 'Educação', 'Lucas Prado', 'lucas@cubo.local'],
  ].map(([id, name, segment, person, email], index) => row(`client-${id}`, { name, segment, person, email, phone: `(11) 9${String(8210 + index * 137).padStart(4, '0')}-${String(4100 + index * 31).slice(-4)}`, status: index === 7 ? 'Em atenção' : 'Ativo', since: `0${index + 2}/0${(index % 8) + 1}/2026`, services: ['Identidade visual', 'Site institucional'], initials: person.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), tone: ['blue', 'green', 'amber', 'purple'][index % 4], notes: [], plannedRevenueMonthly: [1800, 2400, 950, 0, 0, 0, 0, 0][index], demoTag: 'DEMONSTRAÇÃO LOCAL' }));
  const client = (index) => clients[index % clients.length];
  const leads = Array.from({ length: 10 }, (_, index) => {
    const person = ['Joana Martins', 'Felipe Azevedo', 'Lara Campos', 'Diego Freitas', 'Nina Barros', 'Caio Duarte', 'Bia Monteiro', 'Igor Paiva', 'Luiza Melo', 'Theo Ribeiro'][index];
    return row(`lead-${index + 1}`, { name: person, initials: person.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), tone: ['blue', 'green', 'purple', 'amber'][index % 4], company: ['Casa Amora', 'Órbita Tech', 'Ponto Norte', 'Raiz Natural', 'Moinho Studio'][index % 5], email: `contato${index + 1}@exemplo.local`, phone: `(11) 9${String(73400000 + index * 321).slice(0, 8)}`, service: ['Site institucional', 'Identidade visual', 'Gestão de tráfego'][index % 3], note: ['Solicitou uma proposta para lançar a marca no próximo trimestre.', 'Quer atualizar a presença digital da empresa.', 'Procura uma solução que funcione bem no celular.', 'Veio por indicação e quer conversar ainda esta semana.'][index % 4], source: ['Site', 'Indicação', 'Instagram', 'Tráfego pago'][index % 4], stage: index === 9 ? 'Fechado' : ['Novo lead', 'Contato realizado', 'Reunião agendada', 'Diagnóstico'][index % 4], value: [6800, 4200, 9500, 3200, 7800][index % 5], status: index === 9 ? 'Ganho' : 'Aberto', createdAt: new Date(Date.now() - index * 86400000).toISOString(), color: ['blue', 'green', 'amber'][index % 3], demoTag: 'DEMONSTRAÇÃO LOCAL' });
  });
  const projects = Array.from({ length: 7 }, (_, index) => row(`project-${index + 1}`, { name: ['Portal Aurora', 'Marca Vértice', 'Site Flora', 'Campanha Norte Solar', 'Loja Livre & Leve', 'Área do cliente Atlas', 'Plataforma Cubo'][index], client: client(index === 6 ? 7 : index).name, clientId: client(index === 6 ? 7 : index).id, type: ['Site institucional', 'Identidade visual', 'Aplicativo web'][index % 3], status: ['Em andamento', 'Aguardando cliente', 'Em andamento', 'Concluído'][index % 4], progress: [62, 84, 38, 100, 22, 71, 46][index], due: shiftDate(index + 3), createdAt: new Date(Date.now() - index * 86400000).toISOString(), ...(index === 3 ? { completedAt: `${today()}T01:00:00-03:00` } : {}), detail: 'Projeto de demonstração para revisar fluxo, arquivos e entregas.', budget: [12800, 6400, 18500, 9200][index % 4], team: ['Focuss Dev'], demoTag: 'DEMONSTRAÇÃO LOCAL' }));
  const tasks = Array.from({ length: 16 }, (_, index) => row(`task-${index + 1}`, { title: ['Revisar roteiro da página inicial', 'Enviar proposta revisada', 'Validar versão mobile', 'Preparar reunião de descoberta', 'Organizar referências visuais', 'Conferir formulário de contato', 'Revisar contrato de serviço', 'Enviar prévia para aprovação', 'Atualizar conteúdo do projeto', 'Conferir pagamentos do mês', 'Planejar campanha de lançamento', 'Fazer QA de acessibilidade', 'Ajustar seção de serviços', 'Preparar relatório semanal', 'Revisar cronograma de entrega', 'Publicar versão de homologação'][index], client: projects[index % projects.length].client, clientId: projects[index % projects.length].clientId, project: projects[index % projects.length].name, due: index < 8 ? today() : shiftDate(index - 5), time: `${String(9 + index % 8).padStart(2, '0')}:${index % 2 ? '30' : '00'}`, status: ['Em andamento', 'Pendente', 'A fazer', 'Concluída'][index % 4], state: ['Em andamento', 'Pendente', 'A fazer', 'Concluída'][index % 4], priority: ['Alta', 'Média', 'Normal'][index % 3], assignee: ['Focuss Dev', 'Ana Martins', 'Lucas Costa'][index % 3], initials: ['FD', 'AM', 'LC'][index % 3], featured: index === 0, description: [
    'Ajustar a hierarquia da página e revisar os textos antes da apresentação ao cliente.',
    'Incorporar os comentários recebidos e enviar a nova versão para aprovação.',
    'Conferir navegação, formulários e leitura em telas pequenas.',
    'Alinhar escopo, responsáveis e próximos passos do projeto.',
    'Selecionar referências de tipografia, cor e direção visual.',
    'Testar validação, envio e mensagem de confirmação do formulário.',
    'Revisar escopo, valores e dados das partes antes do envio.',
    'Compartilhar os arquivos finais e solicitar aprovação do cliente.',
    'Aplicar as alterações aprovadas no conteúdo do projeto.',
    'Conferir vencimentos, pagamentos recebidos e itens em aberto.',
    'Organizar peças, canais e datas da campanha de lançamento.',
    'Verificar contraste, teclado, foco e nomes acessíveis dos controles.',
    'Conferir descrições, chamadas e links da página de serviços.',
    'Consolidar entregas, pendências e horas registradas na semana.',
    'Atualizar marcos e datas com base no retorno mais recente.',
    'Validar a versão de homologação antes de publicar.'
  ][index], demoTag: 'DEMONSTRAÇÃO LOCAL' }));
  const events = Array.from({ length: 12 }, (_, index) => row(`event-${index + 1}`, { title: ['Briefing — Aurora Café', 'Apresentação de identidade visual', 'Revisão de escopo — Flora', 'Check-in de projeto', 'Reunião de planejamento', 'Aprovação da landing page', 'Alinhamento de conteúdo', 'Demonstração do portal', 'Retorno comercial', 'Revisão de campanha', 'Entrega final — Atlas', 'Planejamento semanal'][index], client: client(index).name, clientId: client(index).id, date: index < 4 ? today() : shiftDate(index - 2), time: `${String(9 + index % 8).padStart(2, '0')}:00`, startsAt: `${index < 4 ? today() : shiftDate(index - 2)}T${String(9 + index % 8).padStart(2, '0')}:00:00-03:00`, duration: 60, type: index % 2 ? 'Reunião' : 'Apresentação', status: 'Agendado', demoTag: 'DEMONSTRAÇÃO LOCAL' }));
  const proposals = Array.from({ length: 6 }, (_, index) => row(`proposal-${index + 1}`, { title: ['Website institucional', 'Identidade visual completa', 'Gestão de conteúdo', 'Landing page de campanha', 'Portal do cliente', 'Evolução do e-commerce'][index], client: client(index).name, clientId: client(index).id, amount: [12800, 6400, 4800, 7200, 15800, 9300][index], value: [12800, 6400, 4800, 7200, 15800, 9300][index], status: ['Enviada', 'Aprovada', 'Em análise', 'Rascunho', 'Enviada', 'Recusada'][index], createdAt: shiftDate(-index * 3), validUntil: shiftDate(20 + index), demoTag: 'DEMONSTRAÇÃO LOCAL' }));
  const services = ['Identidade visual', 'Site institucional', 'Landing page', 'Gestão de tráfego', 'Conteúdo para redes sociais', 'SEO', 'Manutenção mensal', 'Loja virtual', 'Consultoria digital', 'Produção audiovisual'].map((name, index) => row(`service-${index + 1}`, { name, category: ['Marca', 'Web', 'Marketing'][index % 3], description: `Serviço demonstrativo ${name.toLowerCase()} para apresentação do catálogo.`, price: formatLocalDemoCurrency([4200, 12800, 5200, 2800, 1900][index % 5]), cadence: index === 6 ? 'Mensal' : 'Projeto', status: 'Ativo', demoTag: 'DEMONSTRAÇÃO LOCAL' }));
  const contracts = Array.from({ length: 5 }, (_, index) => row(`contract-${index + 1}`, { title: `Contrato de ${['site institucional', 'identidade visual', 'manutenção mensal', 'campanha digital', 'consultoria'][index]}`, code: `DEMO-2026-${String(index + 1).padStart(3, '0')}`, client: client(index).name, clientId: client(index).id, value: formatLocalDemoCurrency([12800, 6400, 1800, 7200, 3500][index]), status: ['Ativo', 'Assinado', 'Em revisão', 'Ativo', 'Aguardando assinatura'][index], renewal: shiftDate(30 + index * 7), demoTag: 'DEMONSTRAÇÃO LOCAL' }));
  const billing = Array.from({ length: 8 }, (_, index) => row(`bill-${index + 1}`, { clientName: client(index).name, client: client(index).name, workspaceClientId: client(index).id, clientId: client(index).id, payerEmail: client(index).email, description: ['Etapa 2 — Portal Aurora', 'Manutenção mensal', 'Identidade visual', 'Hospedagem e suporte', 'Landing page', 'Consultoria mensal', 'Desenvolvimento web', 'Ajuste de campanha'][index], amount: [3200, 1800, 2400, 390, 5200, 1200, 6800, 850][index], method: ['pix', 'boleto'][index % 2], status: ['pending', 'paid', 'pending', 'overdue', 'processing', 'paid', 'pending', 'cancelled'][index], dueAt: `${index === 3 ? shiftDate(-3) : shiftDate(index + 2)}T23:59:00-03:00`, createdAt: new Date(Date.now() - index * 172800000).toISOString(), ...(index === 1 || index === 5 ? { paidAt: `${today()}T01:00:00-03:00` } : {}), paymentDetails: { paymentMethod: ['pix', 'boleto'][index % 2], simulated: true }, demoTag: 'DEMONSTRAÇÃO LOCAL · SEM COBRANÇA REAL' }));
  const subscriptions = Array.from({ length: 4 }, (_, index) => row(`subscription-${index + 1}`, { clientName: client(index).name, client: client(index).name, workspaceClientId: client(index).id, payerEmail: client(index).email, service: ['Suporte mensal', 'Gestão de conteúdo', 'Manutenção de site', 'Consultoria recorrente'][index], description: ['Suporte mensal', 'Gestão de conteúdo', 'Manutenção de site', 'Consultoria recorrente'][index], amount: [1800, 2400, 950, 1250][index], frequency: 'months', frequencyInterval: 1, cycle: 'Mensal', status: index === 3 ? 'paused' : 'authorized', nextDue: shiftDate(6 + index * 4), demoTag: 'DEMONSTRAÇÃO LOCAL' }));
  const recordSet = (resource, items) => [resource, items];
  const simple = (resource, count, make) => [resource, Array.from({ length: count }, (_, index) => row(`${resource}-${index + 1}`, make(index)))];
  return Object.fromEntries([
    recordSet('clients', clients), recordSet('leads', leads), recordSet('projects', projects), recordSet('tasks', tasks), recordSet('events', events), recordSet('proposals', proposals), recordSet('services', services), recordSet('contracts', contracts), recordSet('billing-orders', billing), recordSet('billing-subscriptions', subscriptions),
    simple('contacts', 9, (i) => ({ name: ['Marina Costa', 'Rafael Mendes', 'Camila Rocha', 'André Lima', 'Bianca Alves', 'Pedro Nunes', 'Fernanda Reis', 'Lucas Prado', 'Paula Dias'][i], client: client(i).name, clientId: client(i).id, email: client(i).email, role: ['Diretora', 'Sócio', 'Marketing'][i % 3], phone: client(i).phone, demoTag: 'DEMONSTRAÇÃO LOCAL' })),
    simple('companies', 6, (i) => ({ name: client(i).name, segment: client(i).segment, contact: client(i).person, email: client(i).email, status: 'Ativa', demoTag: 'DEMONSTRAÇÃO LOCAL' })),
    simple('tickets', 6, (i) => ({ code: `TK-DEMO-${String(i + 1).padStart(3, '0')}`, title: ['Atualizar conteúdo do site', 'Dúvida sobre formulário', 'Ajuste de acesso', 'Revisar carregamento mobile', 'Configurar domínio', 'Corrigir espaçamento'][i], client: client(i).name, clientId: client(i).id, status: ['Aberto', 'Em andamento', 'Aguardando cliente', 'Resolvido'][i % 4], priority: ['Normal', 'Alta', 'Média'][i % 3], createdAt: shiftDate(-i), demoTag: 'DEMONSTRAÇÃO LOCAL' })),
    simple('approvals', 5, (i) => ({ title: ['Home — primeira versão', 'Logo principal', 'Texto institucional', 'Criativo de campanha', 'Página de contato'][i], kind: ['PDF', 'Imagem', 'Documento', 'Imagem', 'PDF'][i], client: client(i).name, clientId: client(i).id, project: projects[i].name, status: ['Aguardando', 'Aprovado', 'Aguardando', 'Alterações solicitadas', 'Aguardando'][i], reviewer: ['Ana Martins', 'Focuss Dev', 'Lucas Costa', 'Ana Martins', 'Rafaela Nunes'][i], initials: ['AM', 'FD', 'LC', 'AM', 'RN'][i], sent: shiftDate(-i), comments: [], demoTag: 'DEMONSTRAÇÃO LOCAL' })),
    simple('files', 14, (i) => ({ name: [`Briefing ${client(i).name}.pdf`, 'Logo-final.svg', 'Referências visuais.pdf', 'Fotos do produto.zip', 'Conteúdo institucional.docx'][i % 5], client: client(i).name, clientId: client(i).id, project: projects[i % projects.length].name, date: shiftDate(-i), size: `${(i + 1) * 240} KB`, type: ['PDF', 'Imagem', 'PDF', 'Arquivo', 'Documento'][i % 5], demoTag: 'DEMONSTRAÇÃO LOCAL' })),
    simple('inbox', 10, (i) => ({ name: client(i).person, company: client(i).name, client: client(i).name, clientId: client(i).id, text: ['Consegue me enviar a prévia?', 'Perfeito, vou revisar hoje.', 'Podemos marcar uma conversa?', 'Recebi os arquivos, obrigado!'][i % 4], time: `${10 + i}:15`, unread: i % 3 === 0 ? 1 : 0, demoTag: 'DEMONSTRAÇÃO LOCAL' })),
    simple('revenues', 7, (i) => ({ code: `REC-DEMO-${i + 1}`, description: ['Entrada do projeto', 'Manutenção mensal', 'Etapa de identidade', 'Consultoria'][i % 4], counterparty: client(i).name, client: client(i).name, clientId: client(i).id, category: 'Serviços', amount: [3200, 1800, 2400, 950][i % 4], date: shiftDate(-i), dueDate: shiftDate(i + 4), status: ['Pendente', 'Recebida', 'Pendente'][i % 3], demoTag: 'DEMONSTRAÇÃO LOCAL' })),
    simple('expenses', 6, (i) => ({ code: `DES-DEMO-${i + 1}`, description: ['Hospedagem de projetos', 'Licença de design', 'Material de campanha', 'Serviço de fotografia'][i % 4], counterparty: ['CloudHost', 'Studio Tools', 'Print Lab'][i % 3], client: client(i).name, clientId: client(i).id, category: ['Infraestrutura', 'Ferramentas', 'Produção'][i % 3], amount: [289, 149, 560, 320][i % 4], date: shiftDate(-i), dueDate: shiftDate(i + 5), status: i % 3 ? 'Paga' : 'Pendente', demoTag: 'DEMONSTRAÇÃO LOCAL' })),
    simple('hours', 8, (i) => ({ project: projects[i % projects.length].name, client: projects[i % projects.length].client, clientId: projects[i % projects.length].clientId, title: tasks[i % projects.length].title, assignee: tasks[i % projects.length].assignee, hours: [1.5, 2.25, 0.75, 3, 1.25, 2.5, 1, 1.75][i], date: shiftDate(-i), startedAt: `${shiftDate(-i)}T09:00:00-03:00`, endedAt: `${shiftDate(-i)}T${String(10 + (i % 6)).padStart(2, '0')}:30:00-03:00`, status: 'completed', demoTag: 'DEMONSTRAÇÃO LOCAL' })),
    simple('site-assets', 7, (i) => ({ name: [`auroracafe.local`, `vertice-arq.local`, `florabem.local`, `nortesolar.local`, `livreleve.local`, `atlascontabil.local`, `cuboedu.local`][i], domain: `demo-${i + 1}.local`, client: client(i).name, clientId: client(i).id, type: i % 2 ? 'Site' : 'Domínio + hospedagem', renewalDate: shiftDate(30 + i * 5), health: i % 3 ? 'Não verificado' : 'Online', demoTag: 'DEMONSTRAÇÃO LOCAL' })),
    simple('monitors', 5, (i) => ({ name: `Serviço de demonstração ${i + 1}`, url: `https://monitor-${i + 1}.example.invalid`, client: client(i).name, health: i % 4 ? 'Online' : 'Offline', checkedAt: new Date(Date.now() - i * 3600000).toISOString(), demoTag: 'DEMONSTRAÇÃO LOCAL' })),
    simple('automations', 5, (i) => ({ name: ['Boas-vindas a novo lead', 'Lembrete de tarefa', 'Atualizar cliente após entrega', 'Revisar cobrança vencida', 'Acompanhar aprovação'][i], detail: 'Regra de demonstração. Não envia mensagens nem aciona serviços externos.', trigger: ['Novo lead', 'Prazo próximo', 'Projeto entregue', 'Cobrança vencida', 'Aprovação recebida'][i], action: ['Criar tarefa interna', 'Notificar equipe'][i % 2], active: i < 3, status: i < 3 ? 'active' : 'draft', demoTag: 'DEMONSTRAÇÃO LOCAL' })),
    simple('goals', 4, (i) => ({ name: ['Receita do mês', 'Novos clientes', 'Projetos entregues', 'Horas faturáveis'][i], group: ['Financeiro', 'Comercial', 'Projetos', 'Operação'][i], target: [50000, 8, 12, 120][i], current: [31200, 5, 7, 83][i], unit: i === 0 ? 'BRL' : 'number', period: 'month', color: ['green', 'blue', 'violet', 'amber'][i], demoTag: 'DEMONSTRAÇÃO LOCAL' })),
    simple('team', 4, (i) => ({ name: ['Ana Martins', 'Lucas Costa', 'Rafaela Nunes', 'Focuss Dev'][i], initials: ['AM', 'LC', 'RN', 'FD'][i], email: `equipe${i + 1}@focusshub.local`, role: i === 3 ? 'owner' : 'member', status: 'Ativo', demoTag: 'DEMONSTRAÇÃO LOCAL' })),
    recordSet('settings', [row('settings-workspace', { key: 'workspace-preferences', savedAt: today(), settings: { workspace: { agency: 'Focusshub Studio', timezone: 'America/Sao_Paulo', currency: 'BRL', language: 'pt-BR' }, preferences: { compact: false, darkMode: false, startPage: 'Meu Dia' }, notifications: { taskDue: true, overdue: true, newLead: true, proposal: true, payment: true }, billing: { defaultDueDays: '7', pix: true, boleto: true, card: true } }, demoTag: 'DEMONSTRAÇÃO LOCAL' })]),
    simple('repositories', 3, (i) => ({ name: ['focusshub-demo-web', 'aurora-site-demo', 'flora-portal-demo'][i], provider: 'Demonstração', branch: 'main', status: 'Sem conexão externa', demoTag: 'DEMONSTRAÇÃO LOCAL' })),
    simple('finance-accounts', 3, (i) => ({ name: ['Conta operacional', 'Reserva de impostos', 'Projetos'][i], institution: ['Conta demonstração', 'Banco local fictício', 'Carteira de projetos'][i], balance: [28450, 12500, 8300][i], currency: 'BRL', status: 'Ativa', demoTag: 'DEMONSTRAÇÃO LOCAL' })),
    simple('finance-transactions', 10, (i) => ({ description: ['Recebimento de projeto', 'Assinatura de ferramenta', 'Pagamento de fornecedor'][i % 3], amount: [3200, -149, -560, 1800][i % 4], account: 'Conta operacional', date: shiftDate(-i), status: 'Conciliado', demoTag: 'DEMONSTRAÇÃO LOCAL' })),
  ]);
}

function readStore() {
  let store;
  try { store = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { store = null; }
  if (!store || typeof store !== 'object') return buildSeed();

  // Enrich the existing browser-only examples as the demo schema improves.
  // Keep user edits and deletions; only fill fields missing from current records.
  const seed = buildSeed();
  let changed = false;
  for (const [resource, seededRows] of Object.entries(seed)) {
    if (!Array.isArray(store[resource])) continue;
    const seedById = new Map(seededRows.map((record) => [String(record.id), record]));
    store[resource] = store[resource].map((record) => {
      const defaults = seedById.get(String(record?.id));
      if (!defaults || !record || typeof record !== 'object') return record;
      const enriched = { ...defaults, ...record };
      if (resource === 'contracts') Object.assign(enriched, migrateLegacyDemoContractValue(record, defaults));
      for (const [field, value] of Object.entries(defaults)) {
        if ((enriched[field] === undefined || enriched[field] === null || enriched[field] === '') && value !== undefined) enriched[field] = value;
      }
      if (resource === 'goals' && ['Este mês', 'Este mes'].includes(enriched.period)) enriched.period = 'month';
      if (resource === 'leads' && String(record.id) === 'demo-lead-10' && ['Novo lead', 'Contato realizado', 'Reunião agendada', 'Diagnóstico'].includes(enriched.stage)) {
        enriched.stage = 'Fechado';
      }
      if (resource === 'leads' && String(record.id) === 'demo-lead-10' && enriched.stage === 'Fechado' && ['Aberto', 'Novo'].includes(enriched.status)) enriched.status = 'Ganho';
      if (resource === 'leads' && String(record.id) === 'demo-lead-10' && enriched.stage === 'Fechado' && enriched.status === 'Ganho') enriched.createdAt = `${today()}T01:00:00-03:00`;
      if (resource === 'tasks' && /^demo-task-\d+$/.test(String(record.id)) && enriched.description === 'Atividade de exemplo para demonstrar como o trabalho aparece no Meu Dia.') enriched.description = defaults.description;
      // Migrate only untouched demo fixture timestamps from the previous noon-based seed.
      if (resource === 'billing-orders' && ['demo-bill-2', 'demo-bill-6'].includes(String(record.id)) && enriched.status === 'paid' && String(enriched.paidAt || '').includes('T12:00:00-03:00') && new Date(enriched.paidAt) > new Date()) enriched.paidAt = `${today()}T01:00:00-03:00`;
      if (resource === 'projects' && String(record.id) === 'demo-project-4' && String(enriched.completedAt || '').includes('T12:00:00-03:00') && new Date(enriched.completedAt) > new Date()) enriched.completedAt = `${today()}T01:00:00-03:00`;
      if (JSON.stringify(enriched) !== JSON.stringify(record)) changed = true;
      return enriched;
    });
  }
  const legacyClientLinks = {
    projects: { 'demo-project-7': 'Brisa Imóveis' },
    tasks: { 'demo-task-7': 'Brisa Imóveis', 'demo-task-8': 'Cubo Educação', 'demo-task-15': 'Brisa Imóveis', 'demo-task-16': 'Cubo Educação' },
    hours: { 'demo-hours-7': 'Brisa Imóveis', 'demo-hours-8': 'Cubo Educação' },
  };
  for (const [resource, migrations] of Object.entries(legacyClientLinks)) {
    store[resource] = (store[resource] || []).map((record) => {
      const defaults = seed[resource]?.find((item) => item.id === record.id);
      if (record?.demo && defaults && record.client === migrations[record.id]) {
        const enriched = { ...record, client: defaults.client, clientId: defaults.clientId };
        if (JSON.stringify(enriched) !== JSON.stringify(record)) changed = true;
        return enriched;
      }
      return record;
    });
  }
  if (changed) localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  return store;
}

export function activateLocalDemo() {
  if (!localStorage.getItem(STORAGE_KEY)) localStorage.setItem(STORAGE_KEY, JSON.stringify(buildSeed()));
  localStorage.setItem(ENABLED_KEY, 'true');
  window.dispatchEvent(new CustomEvent('focusshub:demo-mode', { detail: true }));
}

export function resetLocalDemo() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(buildSeed()));
  window.dispatchEvent(new CustomEvent('focusshub:demo-reset'));
}

export function exitLocalDemo() {
  localStorage.removeItem(ENABLED_KEY);
  sessionStorage.removeItem('nexo.api.user');
  sessionStorage.removeItem('nexo.api.token');
}

export function getLocalDemoUser() {
  return { id: 'local-demo-owner', name: 'Focuss Dev', email: 'demo@focusshub.local', role: 'owner', organizationId: 'local-demo-org', organizationName: 'Focusshub · ambiente local' };
}

export function handleLocalDemoRequest(path, options = {}) {
  const url = new URL(path, window.location.origin);
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body) : {};
  const store = readStore();
  const inboxRequest = handleLocalDemoInboxRequest(store, url.pathname, method, body);
  if (inboxRequest) {
    if (inboxRequest.changed) save();
    return inboxRequest.response;
  }
  const siteMonitoring = url.pathname.match(/^\/api\/monitoring\/site-assets\/([^/]+)\/(history|check)$/);
  if (siteMonitoring) {
    const [, rawAssetId, action] = siteMonitoring;
    const assetId = decodeURIComponent(rawAssetId);
    if (action === 'history' && method === 'GET') return { data: getLocalDemoSiteHistory(store, assetId) };
    if (action === 'check' && method === 'POST') {
      const data = checkLocalDemoSite(store, assetId);
      save();
      return { data };
    }
  }
  const leadConversion = url.pathname.match(/^\/api\/workspace\/leads\/([^/]+)\/convert$/);
  if (leadConversion && method === 'POST') {
    const leadId = decodeURIComponent(leadConversion[1]);
    const leadIndex = (store.leads || []).findIndex((item) => String(item.id) === leadId);
    if (leadIndex < 0) throw new Error('Lead não encontrado na demonstração local.');
    const lead = store.leads[leadIndex];
    const conversion = body.data || {};
    const normalize = (value) => String(value || '').trim().toLocaleLowerCase('pt-BR');
    const email = normalize(conversion.email || lead.email);
    const phone = String(conversion.phone || lead.phone || '').replace(/\D/g, '');
    const existingLinkedClient = (store.clients || []).find((item) => String(item.id) === String(lead.convertedClientId));
    const duplicateMatch = existingLinkedClient ? { kind: 'none' } : findLeadDuplicateMatch(store.clients || [], { email, phone });
    if (duplicateMatch.kind === 'ambiguous') throw new Error('O e-mail e o telefone deste lead correspondem a clientes diferentes. Revise os dados antes de converter.');
    let client = existingLinkedClient || (duplicateMatch.kind === 'match' ? duplicateMatch.record : undefined);
    const existing = Boolean(client);
    if (!client) {
      const name = String(conversion.company || lead.company || conversion.name || lead.name || '').trim();
      if (!name) throw new Error('Informe o nome do contato ou da empresa antes de converter.');
      client = row(`client-converted-${crypto.randomUUID()}`, {
        name, person: String(conversion.name || lead.name || name), email, phone,
        source: conversion.source || lead.source || 'Lead', segment: conversion.service || lead.service || '',
        services: [conversion.service || lead.service].filter(Boolean), status: 'Ativo',
        initials: name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
        tone: lead.tone || 'blue', since: `Cliente desde ${today()}`,
        leadId: lead.id, notes: conversion.notes || lead.notes || '', demoTag: 'DEMONSTRAÇÃO LOCAL · SEM AÇÃO EXTERNA',
      });
      store.clients = [client, ...(store.clients || [])];
    }
    const service = String(conversion.service || lead.service || '').trim();
    const services = Array.isArray(client.services) ? client.services.map((item) => String(item || '').trim()).filter(Boolean) : [];
    const normalizeService = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
    if (service && !services.some((item) => normalizeService(item) === normalizeService(service))) {
      client = { ...client, services: [...services, service] };
      store.clients = (store.clients || []).map((item) => String(item.id) === String(client.id) ? client : item);
    }
    const updatedLead = { ...lead, ...conversion, stage: 'Fechado', convertedClientId: client.id, updatedAt: new Date().toISOString() };
    store.leads[leadIndex] = updatedLead;
    save();
    return { data: { lead: updatedLead, client, existing } };
  }
  const proposalAcceptance = url.pathname.match(/^\/api\/workspace\/proposals\/([^/]+)\/accept$/);
  if (proposalAcceptance && method === 'POST') {
    const proposalId = decodeURIComponent(proposalAcceptance[1]);
    const proposals = store.proposals || [];
    const proposalIndex = proposals.findIndex((item) => String(item.id) === proposalId);
    if (proposalIndex < 0) throw new Error('Proposta não encontrada na demonstração local.');
    const proposal = proposals[proposalIndex];
    const existingContract = (store.contracts || []).find((item) => String(item.sourceProposalId) === proposalId);
    const existingProject = (store.projects || []).find((item) => String(item.sourceProposalId) === proposalId);
    if (existingContract && existingProject) return { data: { proposal, contract: existingContract, project: existingProject, tasks: (store.tasks || []).filter((item) => String(item.sourceProposalId) === proposalId), idempotent: true } };
    const acceptanceState = proposalAcceptanceState(proposal.status);
    if (acceptanceState === 'closed') throw new Error('Uma proposta recusada ou expirada não pode ser aceita.');
    if (acceptanceState === 'accepted') throw new Error('A proposta consta como aprovada, mas o contrato e o projeto não estão vinculados. Revise os registros antes de continuar.');
    const client = (store.clients || []).find((item) => String(item.id) === String(proposal.clientId));
    if (!client) throw new Error('Vincule a proposta a um cliente cadastrado antes de aceitá-la.');
    const demoTag = 'DEMONSTRAÇÃO LOCAL · SEM AÇÃO EXTERNA';
    const contract = { ...body.contract, id: `demo-contract-from-${proposalId}`, title: proposal.title || body.contract?.title || 'Contrato', client: client.name, clientId: client.id, sourceProposalId: proposalId, status: 'Rascunho', tone: 'gray', demo: true, demoTag };
    const project = { ...body.project, id: `demo-project-from-${proposalId}`, client: client.name, clientId: client.id, sourceProposalId: proposalId, status: 'Em andamento', progress: 0, demo: true, demoTag };
    const tasks = (Array.isArray(body.tasks) ? body.tasks : []).map((task) => ({ ...task, id: `demo-task-from-${proposalId}-${crypto.randomUUID()}`, project: project.name, projectId: project.id, client: client.name, clientId: client.id, sourceProposalId: proposalId, demo: true, demoTag }));
    if (!tasks.length) throw new Error('A proposta precisa gerar pelo menos uma tarefa.');
    store.contracts = [contract, ...(store.contracts || [])];
    store.projects = [project, ...(store.projects || [])];
    store.tasks = [...tasks, ...(store.tasks || [])];
    const updatedProposal = { ...proposal, status: 'Aprovada', tone: 'green', acceptedAt: new Date().toISOString() };
    store.proposals[proposalIndex] = updatedProposal;
    save();
    return { data: { proposal: updatedProposal, contract, project, tasks, idempotent: false } };
  }
  if (url.pathname === '/api/workspace/preferences') return { data: { compact: false, startPage: 'Meu Dia', darkMode: false } };
  if (url.pathname === '/api/notifications') return { data: (store.events || []).slice(0, 4).map((event, index) => ({ id: `demo-notification-${index}`, title: event.title, detail: `${event.client} · ${event.time}`, createdAt: new Date().toISOString(), unread: index < 2 })), unreadCount: 2 };
  if (url.pathname === '/api/notifications/read') return { data: { readAt: new Date().toISOString() } };
  if (url.pathname === '/api/team/users' && method === 'GET') return { data: store.team || [] };
  if (url.pathname === '/api/workspace/assignees' && method === 'GET') return { data: store.team || [] };
  const resourceMatch = url.pathname.match(/^\/api\/workspace\/([a-z-]+)(?:\/([^/]+))?$/);
  if (resourceMatch) {
    const [, resource, id] = resourceMatch;
    const records = store[resource] || [];
    if (method === 'GET' && id) return { data: records.find((item) => item.id === id) || null };
    if (method === 'GET') { const offset = Number(url.searchParams.get('offset') || 0); const limit = Math.min(200, Number(url.searchParams.get('limit') || 200)); return { data: records.slice(offset, offset + limit), pagination: { limit, offset, total: records.length } }; }
    if (method === 'POST') { const item = row(`${resource}-${crypto.randomUUID()}`, body.data || {}); store[resource] = [item, ...records]; save(); return { data: item }; }
    if (method === 'PATCH') { const next = records.map((item) => item.id === id ? { ...item, ...(body.data || {}), updatedAt: new Date().toISOString() } : item); store[resource] = next; save(); return { data: next.find((item) => item.id === id) || null }; }
    if (method === 'DELETE') {
      if (resource === 'site-assets') removeLocalDemoSiteAsset(store, id);
      else store[resource] = records.filter((item) => item.id !== id);
      save(); return { data: null };
    }
  }
  const billingResource = url.pathname === '/api/billing/orders' ? 'billing-orders' : url.pathname === '/api/billing/subscriptions' ? 'billing-subscriptions' : null;
  if (billingResource) {
    const records = store[billingResource] || [];
    if (method === 'GET') { const offset = Number(url.searchParams.get('offset') || 0); const limit = Math.min(200, Number(url.searchParams.get('limit') || 200)); return { data: records.slice(offset, offset + limit), pagination: { limit, offset, total: records.length } }; }
    if (method === 'POST') { const item = row(`${billingResource}-${crypto.randomUUID()}`, { ...body, ...(body.dueDate ? { dueAt: `${body.dueDate}T23:59:59-03:00` } : {}), status: 'pending', demoTag: 'DEMONSTRAÇÃO LOCAL · SEM AÇÃO EXTERNA', createdAt: new Date().toISOString(), paymentDetails: { simulated: true } }); store[billingResource] = [item, ...records]; save(); return { data: item }; }
  }
  const cancelBillingOrder = url.pathname.match(/^\/api\/billing\/orders\/([^/]+)\/cancel$/);
  if (cancelBillingOrder && method === 'POST') {
    const [, id] = cancelBillingOrder;
    const records = store['billing-orders'] || [];
    const target = records.find((item) => item.id === id);
    if (!target || target.status !== 'pending') return { data: target || null, status: 'demo_only', message: 'Apenas cobranças fictícias aguardando pagamento podem ser canceladas.' };
    store['billing-orders'] = records.map((item) => item.id === id ? { ...item, status: 'cancelled', paymentDetails: { ...(item.paymentDetails || {}), status: 'canceled' }, updatedAt: new Date().toISOString() } : item);
    save(); return { data: store['billing-orders'].find((item) => item.id === id) };
  }
  const refreshBillingOrder = url.pathname.match(/^\/api\/billing\/orders\/([^/]+)\/refresh$/);
  if (refreshBillingOrder && method === 'POST') {
    const [, id] = refreshBillingOrder;
    const item = (store['billing-orders'] || []).find((record) => record.id === id);
    return { data: item || null, changed: false, status: 'demo_only' };
  }
  const subscriptionStatus = url.pathname.match(/^\/api\/billing\/subscriptions\/([^/]+)\/status$/);
  if (subscriptionStatus && method === 'PATCH') {
    const [, id] = subscriptionStatus;
    store['billing-subscriptions'] = (store['billing-subscriptions'] || []).map((item) => item.id === id ? { ...item, status: body.status || item.status, updatedAt: new Date().toISOString() } : item);
    save(); return { data: store['billing-subscriptions'].find((item) => item.id === id) || null };
  }
  const subscriptionAction = url.pathname.match(/^\/api\/billing\/subscriptions\/([^/]+)\/(pause|resume|cancel)$/);
  if (subscriptionAction && method === 'POST') {
    const [, id, action] = subscriptionAction;
    store['billing-subscriptions'] = (store['billing-subscriptions'] || []).map((item) => item.id === id ? { ...item, status: action === 'pause' ? 'paused' : action === 'resume' ? 'authorized' : 'cancelled' } : item);
    save(); return { data: store['billing-subscriptions'].find((item) => item.id === id) || null };
  }
  if (url.pathname.startsWith('/api/integrations/') || url.pathname.startsWith('/api/portal/')) return { data: [], status: 'demo_only', message: 'Integrações externas estão desativadas no modo de demonstração local.' };
  return { data: [], pagination: { limit: 200, offset: 0, total: 0 }, status: 'demo_only' };

  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); window.dispatchEvent(new CustomEvent('focusshub:demo-data-changed', { detail: url.pathname })); }
}
