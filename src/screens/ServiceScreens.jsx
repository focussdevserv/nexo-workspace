import React, { useEffect, useRef, useState } from 'react';
import {
  Activity, AlertCircle, ArrowDownLeft, ArrowUpRight, BadgeCheck, Bell, CalendarClock,
  Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, Copy,
  Clock3, Cloud, CreditCard, ExternalLink, FileText, Filter, Globe2, HardDrive,
  LifeBuoy, Link2, Mail, MessageCircle, MoreHorizontal, Paperclip, Plus, RefreshCw, Search,
  Pencil, Play, Send, Settings2, ShieldCheck, Smartphone, Sparkles, Trash2, TrendingUp, Unplug, Wallet,
  X,
} from 'lucide-react';
import './service.css';
import './integrations.css';
import './automations.css';
import './subscriptions.css';
import './billing.css';
import { PaymentConsole } from './PaymentScreens.jsx';
import { apiRequest, useWorkspaceRecords } from '../lib/workspace-api.js';

function useStoredArray(key, fallback) {
  const resources = { 'nexo.finance.receitas.v1': 'revenues', 'nexo.finance.despesas.v1': 'expenses', 'nexo.finance.accounts.v1': 'finance-accounts', 'nexo.support.conversations.v1': 'inbox', 'nexo.support.tickets.v1': 'tickets', 'nexo.sites.assets.v1': 'site-assets', 'nexo.sites.monitors.v1': 'monitors' };
  const resource = resources[key];
  const path = key === 'nexo.billing.v1' ? '/api/billing/orders' : `/api/workspace/${resource}`;
  const [value, setValue] = useState([]);
  const ref = useRef(value);
  useEffect(() => { let active = true; apiRequest(path).then((result) => { if (active) { ref.current = result.data || []; setValue(ref.current); } }).catch((error) => window.dispatchEvent(new CustomEvent('nexo:workspace-error', { detail: error.message }))); return () => { active = false; }; }, [path]);
  const persist = (nextOrUpdater) => {
    const previous = ref.current; const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(previous) : nextOrUpdater; ref.current = next; setValue(next);
    if (!resource) { window.dispatchEvent(new CustomEvent('nexo:workspace-error', { detail: 'Este tipo de registro exige a tela de cobrança Mercado Pago.' })); return next; }
    const oldById = new Map(previous.map((item) => [String(item.id), item])); const newById = new Map(next.map((item) => [String(item.id), item]));
    const clean = (item) => Object.fromEntries(Object.entries(item).filter(([field]) => !['id','createdAt','updatedAt'].includes(field)));
    Promise.all([
      ...next.filter((item) => !oldById.has(String(item.id))).map(async (item) => { const saved = await apiRequest(`/api/workspace/${resource}`, { method: 'POST', body: JSON.stringify({ data: clean(item) }) }); ref.current = ref.current.map((row) => String(row.id) === String(item.id) ? saved.data : row); setValue(ref.current); }),
      ...next.filter((item) => oldById.has(String(item.id)) && JSON.stringify(clean(item)) !== JSON.stringify(clean(oldById.get(String(item.id))))).map((item) => apiRequest(`/api/workspace/${resource}/${item.id}`, { method: 'PATCH', body: JSON.stringify({ data: clean(item) }) })),
      ...previous.filter((item) => !newById.has(String(item.id))).map((item) => apiRequest(`/api/workspace/${resource}/${item.id}`, { method: 'DELETE' })),
    ]).catch((error) => window.dispatchEvent(new CustomEvent('nexo:workspace-error', { detail: error.message })));
    return next;
  };
  return [value, persist];
}

const financeRows = { receitas: [], despesas: [], cobrancas: [] };

const subscriptions = [];

const initialMessages = [];

const initialTickets = [];

const assets = [];

const monitors = [];

const integrations = [
  { name: 'Mercado Pago', detail: 'Cobranças, pagamentos e recorrências', icon: CreditCard, color: 'mercado', fields: [['accessToken', 'Access token', true], ['publicKey', 'Public key', false]] },
  { name: 'Evolution API', detail: 'Instâncias, conversas e notificações WhatsApp', icon: MessageCircle, color: 'whatsapp', fields: [['baseUrl', 'URL da API', false], ['instance', 'Nome da instância', false], ['apiKey', 'API key', true]] },
  { name: 'WAHA', detail: 'Sessões WhatsApp e mensagens', icon: Smartphone, color: 'whatsapp', fields: [['baseUrl', 'URL da API', false], ['session', 'Nome da sessão', false], ['apiKey', 'API key', true]] },
  { name: 'Resend', detail: 'E-mails de propostas e notificações', icon: Mail, color: 'google', fields: [['apiKey', 'API key', true], ['fromEmail', 'E-mail remetente', false]] },
  { name: 'Google Workspace', detail: 'Gmail, Calendar, Drive e Meet', icon: CalendarClock, color: 'google', fields: [['clientId', 'OAuth client ID', false], ['redirectUri', 'URL de retorno', false]] },
  { name: 'GitHub', detail: 'Repositórios, commits e deploys', icon: Activity, color: 'github', fields: [['organization', 'Usuário ou organização', false], ['token', 'Personal access token', true]] },
  { name: 'n8n', detail: 'Automações e fluxos de trabalho', icon: Sparkles, color: 'sign', fields: [['baseUrl', 'URL do n8n', false], ['apiKey', 'API key', true]] },
  { name: 'Sentry', detail: 'Erros e incidentes das aplicações', icon: AlertCircle, color: 'sentry', fields: [['dsn', 'Project DSN', false], ['authToken', 'Auth token', true]] },
];

const initialAutomations = [];

const pageInfo = {
  financeiro: ['Financeiro', 'Uma visão do que entra, sai e precisa de atenção.'],
  receitas: ['Receitas', 'Acompanhe os valores recebidos e previstos.'],
  despesas: ['Despesas', 'Organize os custos e pagamentos da operação.'],
  contas: ['Contas', 'Saldo e movimentação das contas conectadas.'],
  cobrancas: ['Cobranças', 'Acompanhe cobranças enviadas e vencimentos.'],
  assinaturas: ['Assinaturas', 'Receita recorrente e próximos ciclos.'],
  caixa_entrada: ['Caixa de entrada', 'Conversas de WhatsApp e atendimento em um só lugar.'],
  whatsapp: ['WhatsApp', 'Atenda seus clientes sem perder o contexto.'],
  tickets: ['Tickets', 'Solicitações técnicas e suporte aos clientes.'],
  sites: ['Sites e domínios', 'Sites, domínios e hospedagens dos seus clientes.'],
  dominios: ['Domínios', 'Renovações e dados dos domínios dos clientes.'],
  hospedagens: ['Hospedagens', 'Infraestrutura e renovações dos sites.'],
  monitoramento: ['Monitoramento', 'Disponibilidade e desempenho dos seus serviços.'],
  integracoes: ['Integrações', 'Conecte as ferramentas usadas pela sua equipe.'],
  automacoes: ['Automações', 'Acompanhe os fluxos que conectam seu trabalho.'],
};

function normalizePage(page) {
  const raw = String(page ?? 'financeiro').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s/-]+/g, '_');
  const aliases = { inbox: 'caixa_entrada', entrada: 'caixa_entrada', atendimento: 'caixa_entrada', 'caixa_de_entrada': 'caixa_entrada', 'sites_dominios_hospedagens': 'sites', operacoes: 'monitoramento', integracoes_e_automacoes: 'integracoes' };
  return aliases[raw] || (pageInfo[raw] ? raw : 'financeiro');
}

function money(value) { return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function navigateTo(label) { window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: label })); }

function IconButton({ label, onClick, children }) {
  return <button className="ns-icon-button" type="button" aria-label={label} title={label} onClick={onClick}>{children}</button>;
}

function PageHeading({ page, action, onAction }) {
  const [title, subtitle] = pageInfo[page];
  return <div className="ns-heading"><div><span className="ns-crumb">Nexo <ChevronRight size={13} /> {page === 'caixa_entrada' || page === 'whatsapp' || page === 'tickets' ? 'Atendimento' : ['sites', 'dominios', 'hospedagens', 'monitoramento', 'integracoes', 'automacoes'].includes(page) ? 'Operações técnicas' : 'Financeiro'}</span><h1>{title}</h1><p>{subtitle}</p></div>{action && <button type="button" className="ns-primary" onClick={onAction}><Plus size={16} />{action}</button>}</div>;
}

function Toast({ message, onClose }) {
  if (!message) return null;
  return <div className="ns-toast" role="status"><CheckCircle2 size={17} />{message}<button type="button" onClick={onClose} aria-label="Fechar aviso"><X size={15} /></button></div>;
}

function Metric({ label, value, note, icon: Icon, trend }) {
  return <article className="ns-metric"><div className="ns-metric-top"><span>{label}</span><span className="ns-metric-icon"><Icon size={17} /></span></div><strong>{value}</strong><div className="ns-metric-note">{trend && <span><TrendingUp size={13} />{trend}</span>}{note}</div></article>;
}

function Status({ children }) {
  const text = String(children).toLowerCase();
  const variant = /atras|vencid|instabilidade|pendente|aberto/.test(text) ? 'warning' : /recebid|paga|ativa|operacional|resolvido|em dia|conectado|conclu/.test(text) ? 'success' : 'neutral';
  return <span className={`ns-status ${variant}`}><i />{children}</span>;
}

function DataTable({ columns, rows, search, onAction, empty = 'Nenhum registro encontrado.', statusIndex }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const statusColumn = statusIndex ?? (rows[0]?.length ?? 1) - 1;
  const shown = rows.filter((row) => row.join(' ').toLowerCase().includes(query.toLowerCase()) && (filter === 'Todos' || row[statusColumn] === filter));
  return <section className="ns-panel ns-table-panel">
    <div className="ns-panel-toolbar"><div className="ns-filter-tabs">{['Todos', ...new Set(rows.map((row) => row[statusColumn]))].slice(0, 4).map((item) => <button className={filter === item ? 'selected' : ''} key={item} onClick={() => setFilter(item)} type="button">{item}</button>)}</div><div className="ns-tools">{search && <label className="ns-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" /></label>}<IconButton label="Filtros" onClick={() => setFilter('Todos')}><Filter size={15} /></IconButton></div></div>
      <div className="ns-table-scroll"><table className="ns-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}<th aria-label="Ações" /></tr></thead><tbody>{shown.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.slice(0, columns.length).map((cell, cellIndex) => <td key={cellIndex}>{cellIndex === statusColumn ? <Status>{cell}</Status> : cellIndex === 0 ? <b className="ns-row-id">{cell}</b> : cell}</td>)}<td><IconButton label="Mais opções" onClick={() => onAction(`Opções de ${row[0]}`)}><MoreHorizontal size={17} /></IconButton></td></tr>)}{shown.length === 0 && <tr><td className="ns-empty" colSpan={columns.length + 1}>{empty}</td></tr>}</tbody></table></div>
    <div className="ns-table-footer"><span>Mostrando {shown.length} de {rows.length} registros</span><div><button type="button" aria-label="Página anterior"><ChevronLeft size={15} /></button><b>1</b><button type="button" aria-label="Próxima página"><ChevronRight size={15} /></button></div></div>
  </section>;
}

function FinanceOverview({ notify, onCreate }) {
  const [revenues] = useStoredArray('nexo.finance.receitas.v1', financeRows.receitas);
  const [expenses] = useStoredArray('nexo.finance.despesas.v1', financeRows.despesas);
  const [billing] = useStoredArray('nexo.billing.v1', billingSeed);
  const [accounts] = useStoredArray('nexo.finance.accounts.v1', []);
  const parseAmount = (value) => Number(String(value ?? '').replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  const sumRows = (rows) => rows.reduce((sum, row) => sum + parseAmount(Array.isArray(row) ? row[4] : row.amount), 0);
  const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);
  const openBills = billing.filter((bill) => !['Paga', 'Cancelada'].includes(bill.status));
  const recent = [...revenues.map((row) => [row[0], row[1], row[3], `+ ${row[4]}`, row[5]]), ...expenses.map((row) => [row[0], row[1], row[3], `− ${row[4]}`, row[5]])].slice(0, 8);
  return <>
    <div className="ns-metrics ns-metrics-four"><Metric label="Saldo registrado" value={money(totalBalance)} note={`${accounts.length} contas locais`} icon={Wallet} /><Metric label="Receitas cadastradas" value={money(sumRows(revenues))} note={`${revenues.length} lançamentos`} icon={ArrowDownLeft} /><Metric label="Despesas cadastradas" value={money(sumRows(expenses))} note={`${expenses.length} lançamentos`} icon={ArrowUpRight} /><Metric label="A receber" value={money(openBills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0))} note={`${openBills.length} cobranças abertas`} icon={Clock3} /></div>
    <div className="ns-finance-grid"><section className="ns-panel ns-cash-panel"><div className="ns-panel-title"><div><h2>Fluxo de caixa</h2><p>Entradas e saídas · últimos 6 meses</p></div><span className="ns-select">Dados cadastrados</span></div><div className="ns-chart-legend"><span><i className="income-dot" />Receitas</span><span><i className="expense-dot" />Despesas</span></div><div className="ns-chart-empty">Cadastre receitas e despesas para visualizar o fluxo de caixa.</div></section>
      <section className="ns-panel ns-attention"><div className="ns-panel-title"><div><h2>Precisa de atenção</h2><p>Itens que pedem uma ação</p></div><Bell size={17} /></div>{openBills.length ? <button onClick={() => navigateTo('Cobranças')} type="button"><span className="ns-attention-icon orange"><Clock3 size={16} /></span><span><b>{openBills.length} cobrança(s) em aberto</b><small>Veja os vencimentos e pagamentos registrados.</small></span><ChevronRight size={16} /></button> : <p className="ns-empty">Nenhuma cobrança em aberto.</p>}</section></div>
    <div className="ns-section-heading"><div><h2>Movimentações recentes</h2><p>Últimas entradas e saídas registradas</p></div><button type="button" className="ns-text-button" onClick={() => navigateTo('Receitas')}>Ver receitas <ChevronRight size={15} /></button></div>
    <DataTable columns={['Descrição', 'Cliente / categoria', 'Data', 'Valor', 'Status']} rows={recent} search onAction={notify} />
  </>;
}

function Accounts({ notify }) {
  const key = 'nexo.finance.accounts.v1';
  const defaults = [];
  const [accounts, setAccounts] = useStoredArray(key, defaults);
  const [transactions, setTransactions] = useState(() => { try { return JSON.parse(localStorage.getItem(`${key}.transactions`) || 'null') || []; } catch { return []; } });
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState('Todas');
  const [draft, setDraft] = useState({ name: '', bank: '', balance: '0' });
  const saveList = (next) => { setAccounts(next);  };
  const saveTransactionList = (next) => { setTransactions(next);  };
  const openNew = () => { setEditing(null); setDraft({ name: '', bank: '', balance: '0' }); setModal(true); };
  const openEdit = (account) => { setEditing(account.name); setDraft({ name: account.name, bank: account.bank, balance: String(account.balance) }); setModal(true); };
  const save = (event) => { event.preventDefault(); if (!draft.name.trim() || !draft.bank.trim()) return; const entry = { name: draft.name.trim(), bank: draft.bank.trim(), balance: Number(draft.balance) || 0, color: editing ? accounts.find((a) => a.name === editing)?.color || 'green' : 'green', icon: Wallet }; saveList(editing ? accounts.map((a) => a.name === editing ? entry : a) : [...accounts, entry]); setModal(false); notify(editing ? 'Conta atualizada no workspace.' : 'Conta cadastrada no workspace.'); };
  const remove = (account) => { if (!window.confirm(`Remover ${account.name}? As movimentações registradas nela também serão removidas.`)) return; saveList(accounts.filter((a) => a.name !== account.name)); saveTransactionList(transactions.filter((row) => row[1] !== account.name)); notify('Conta removida localmente.'); };
  const exportCsv = () => { const csv = [['Conta', 'Instituição', 'Saldo'], ...accounts.map((a) => [a.name, a.bank, a.balance])].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\n'); const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'nexo-contas.csv'; link.click(); URL.revokeObjectURL(url); notify('CSV das contas exportado.'); };
  const visibleTransactions = transactions.filter((row) => selected === 'Todas' || row[1] === selected);
  const total = accounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const actionRows = visibleTransactions.map((row) => [row[0], row[1], row[2], row[3], row[4]]);
  return <><div className="ns-metrics ns-metrics-three"><Metric label="Saldo total registrado" value={money(total)} note={`${accounts.length} contas`} icon={Wallet} /><Metric label="Contas conectadas" value="0" note="Nenhum provedor conectado" icon={Link2} /><Metric label="Movimentações" value={String(transactions.length).padStart(2, '0')} note="Registros locais" icon={Activity} /></div><div className="ns-section-heading"><div><h2>Suas contas</h2><p>Cadastre contas e acompanhe saldos e movimentações.</p></div><button className="ns-primary" type="button" onClick={openNew}><Plus size={15} />Adicionar conta</button></div><div className="ns-account-grid">{accounts.map((account) => <article className="ns-account-card" key={account.name}><div className="ns-account-head"><span className={`ns-bank-icon ${account.color}`}><Wallet size={19} /></span><div className="ns-account-actions"><IconButton label={`Editar ${account.name}`} onClick={() => openEdit(account)}><Pencil size={15} /></IconButton><IconButton label={`Remover ${account.name}`} onClick={() => remove(account)}><Trash2 size={15} /></IconButton></div></div><small>{account.name}</small><b>{money(Number(account.balance))}</b><span>{account.bank}</span><button type="button" onClick={() => setSelected(account.name)}>Ver movimentações <ChevronRight size={15} /></button></article>)}<button type="button" className="ns-add-account" onClick={openNew}><span><Plus size={18} /></span><b>Adicionar conta</b><small>Registre uma conta e saldo inicial</small></button></div><div className="ns-section-heading"><div><h2>Movimentações recentes</h2><p>{selected === 'Todas' ? 'Entradas e saídas das contas' : `Movimentações de ${selected}`} <button className="ns-link-button" onClick={() => setSelected('Todas')}>Ver todas</button></p></div><button className="ns-text-button" type="button" onClick={exportCsv}>Exportar <ExternalLink size={14} /></button></div><DataTable columns={['Lançamento', 'Conta', 'Data', 'Valor', 'Status']} rows={actionRows} search onAction={notify} />
    <div className="ns-info-note"><ShieldCheck size={17} /><span>O saldo é informado manualmente; esta tela não se conecta a bancos nem sincroniza transações.</span></div>
    {modal && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false); }}><form className="ns-integration-modal" onSubmit={save}><header><span className="ns-integration-logo mercado"><Wallet size={18} /></span><div><h2>{editing ? 'Editar conta' : 'Adicionar conta'}</h2><p>Informe os dados para o controle local.</p></div><button type="button" aria-label="Fechar" onClick={() => setModal(false)}><X size={17} /></button></header><div className="ns-integration-fields"><label>Nome da conta<input autoFocus required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Conta principal" /></label><label>Banco ou instituição<input required value={draft.bank} onChange={(e) => setDraft({ ...draft, bank: e.target.value })} placeholder="Ex.: Nubank" /></label><label>Saldo inicial<input type="number" step="0.01" value={draft.balance} onChange={(e) => setDraft({ ...draft, balance: e.target.value })} /></label></div><div className="ns-integration-modal-note"><ShieldCheck size={15} />Nenhuma conexão bancária é iniciada por este formulário.</div><footer><button className="ns-secondary" type="button" onClick={() => setModal(false)}>Cancelar</button><button className="ns-primary" type="submit"><Check size={14} />Salvar conta</button></footer></form></div>}</>;
}

function Subscriptions({ notify }) {
  const key = 'nexo.finance.subscriptions.v1';
  const [items, setItems] = useState(() => { try { const saved = JSON.parse(localStorage.getItem(key) || 'null'); return Array.isArray(saved) ? saved : subscriptions.map((row, index) => ({ id: `sub-${index}`, client: row[0], service: row[1], amount: Number(row[2].replace(/[^\d,]/g, '').replace(',', '.')), cycle: 'Mensal', dueDay: Number(row[3].match(/\d+/)?.[0] || 5), status: row[4] === 'Ativa' ? 'Ativa' : 'Pagamento pendente', method: 'Pix', nextDue: row[3] })); } catch { return []; } });
  const [filter, setFilter] = useState('Todas');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ client: '', service: '', amount: '', cycle: 'Mensal', dueDay: '10', method: 'Pix' });
  const persist = (next) => { setItems(next); try {  } catch { notify('Não foi possível salvar as assinaturas neste navegador.'); } };
  const active = items.filter((item) => item.status === 'Ativa');
  const mrr = active.reduce((sum, item) => sum + Number(item.amount) * (item.cycle === 'Anual' ? 1 / 12 : item.cycle === 'Trimestral' ? 1 / 3 : 1), 0);
  const pending = items.filter((item) => item.status === 'Pagamento pendente').length;
  const visible = items.filter((item) => (filter === 'Todas' || item.status === filter) && `${item.client} ${item.service}`.toLowerCase().includes(query.toLowerCase()));
  const openNew = () => { setEditing(null); setDraft({ client: '', service: '', amount: '', cycle: 'Mensal', dueDay: '10', method: 'Pix' }); setModal(true); };
  const openEdit = (item) => { setEditing(item.id); setDraft({ client: item.client, service: item.service, amount: String(item.amount), cycle: item.cycle, dueDay: String(item.dueDay), method: item.method }); setModal(true); };
  const save = (event) => {
    event.preventDefault();
    if (!draft.client.trim() || !draft.service.trim() || Number(draft.amount) <= 0) return;
    const existing = items.find((item) => item.id === editing);
    const entry = { id: editing || globalThis.crypto?.randomUUID?.() || `sub-${Date.now()}`, ...draft, client: draft.client.trim(), service: draft.service.trim(), amount: Number(draft.amount), dueDay: Number(draft.dueDay), status: existing?.status || 'Ativa', nextDue: `Todo dia ${draft.dueDay}` };
    persist(editing ? items.map((item) => item.id === editing ? entry : item) : [entry, ...items]); setModal(false); notify(editing ? 'Assinatura atualizada.' : 'Assinatura criada como demonstração.');
  };
  const togglePause = (item) => { const status = item.status === 'Pausada' ? 'Ativa' : 'Pausada'; persist(items.map((entry) => entry.id === item.id ? { ...entry, status } : entry)); notify(`${item.client}: assinatura ${status.toLowerCase()}.`); };
  const cancel = (item) => { if (!window.confirm(`Cancelar a assinatura de ${item.client}?`)) return; persist(items.map((entry) => entry.id === item.id ? { ...entry, status: 'Cancelada' } : entry)); notify(`Assinatura de ${item.client} cancelada na demonstração.`); };
  const removeCancelled = (item) => { if (item.status !== 'Cancelada') { cancel(item); return; } if (!window.confirm(`Excluir definitivamente o registro local de ${item.client}?`)) return; persist(items.filter((entry) => entry.id !== item.id)); notify('Registro local da assinatura removido.'); };
  const markPending = (item) => { persist(items.map((entry) => entry.id === item.id ? { ...entry, status: 'Pagamento pendente' } : entry)); notify(`Cobrança de ${money(item.amount)} preparada para ${item.client}.`); };
  const markPaid = (item) => { persist(items.map((entry) => entry.id === item.id ? { ...entry, status: 'Ativa' } : entry)); notify(`Pagamento de ${item.client} registrado localmente.`); };
  return <>
    <div className="ns-metrics ns-metrics-three"><Metric label="Receita recorrente mensal" value={money(mrr)} note={`${active.length} assinaturas ativas`} icon={RefreshCw} /><Metric label="Próxima cobrança" value={items.find((item) => item.status === 'Ativa') ? money(items.find((item) => item.status === 'Ativa').amount) : money(0)} note={items.find((item) => item.status === 'Ativa') ? `${items.find((item) => item.status === 'Ativa').client} · ${items.find((item) => item.status === 'Ativa').nextDue}` : 'Nenhuma cobrança prevista'} icon={CalendarClock} /><Metric label="Atenção necessária" value={`${pending} ${pending === 1 ? 'assinatura' : 'assinaturas'}`} note="com pagamento pendente" icon={AlertCircle} /></div>
    <div className="ns-section-heading ns-subscription-heading"><div><h2>Planos recorrentes</h2><p>Gerencie o ciclo e as próximas cobranças dos clientes.</p></div><button type="button" className="ns-primary" onClick={openNew}><Plus size={15} />Nova assinatura</button></div>
    <div className="ns-subscription-controls"><nav>{['Todas', 'Ativa', 'Pagamento pendente', 'Pausada', 'Cancelada'].map((item) => <button type="button" key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</nav><label><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente ou plano" /></label></div>
    <div className="ns-subscription-table"><div className="ns-sub-row ns-sub-labels"><span>Cliente</span><span>Serviço</span><span>Valor / ciclo</span><span>Próximo vencimento</span><span>Pagamento</span><span>Status</span><span>Ações</span></div>{visible.map((item) => <div className="ns-sub-row" key={item.id}><span className="ns-sub-client"><b>{item.client}</b><small>{item.cycle} · dia {item.dueDay}</small></span><span>{item.service}</span><b>{money(item.amount)}<small className="ns-sub-cycle"> / {item.cycle.toLowerCase()}</small></b><span>{item.nextDue}</span><span>{item.method}</span><span className={`ns-sub-status ${item.status === 'Ativa' ? 'active' : item.status === 'Pagamento pendente' ? 'pending' : item.status === 'Pausada' ? 'paused' : 'ended'}`}><i />{item.status}</span><div className="ns-sub-actions"><button aria-label={`Editar assinatura de ${item.client}`} onClick={() => openEdit(item)}><Pencil size={14} /></button>{item.status === 'Pagamento pendente' ? <button aria-label={`Registrar pagamento de ${item.client}`} onClick={() => markPaid(item)}><Check size={14} /></button> : <button aria-label={`${item.status === 'Pausada' ? 'Retomar' : 'Pausar'} assinatura de ${item.client}`} disabled={item.status === 'Cancelada'} onClick={() => togglePause(item)}>{item.status === 'Pausada' ? <Play size={14} /> : <X size={14} />}</button>}<button aria-label={`Preparar cobrança de ${item.client}`} disabled={item.status === 'Cancelada'} onClick={() => markPending(item)}><CircleDollarSign size={14} /></button><button aria-label={item.status === 'Cancelada' ? `Excluir assinatura de ${item.client}` : `Cancelar assinatura de ${item.client}`} onClick={() => removeCancelled(item)}><Trash2 size={14} /></button></div></div>)}{!visible.length && <div className="ns-empty-history">Nenhuma assinatura encontrada com este filtro.</div>}</div>
    <div className="ns-info-note"><ShieldCheck size={17} /><span>Dados de demonstração salvos neste navegador. As cobranças recorrentes só serão criadas quando o Mercado Pago e o backend estiverem conectados.</span></div>
    {modal && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false); }}><form className="ns-integration-modal ns-subscription-modal" onSubmit={save}><header><span className="ns-integration-logo mercado"><RefreshCw size={18} /></span><div><h2>{editing ? 'Editar assinatura' : 'Nova assinatura'}</h2><p>Defina o plano recorrente do cliente.</p></div><button type="button" aria-label="Fechar" onClick={() => setModal(false)}><X size={17} /></button></header><div className="ns-integration-fields"><label>Cliente<input autoFocus required value={draft.client} onChange={(event) => setDraft({ ...draft, client: event.target.value })} placeholder="Nome do cliente" /></label><label>Serviço contratado<input required value={draft.service} onChange={(event) => setDraft({ ...draft, service: event.target.value })} placeholder="Ex.: Manutenção de site" /></label><label>Valor por ciclo<input required type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="800,00" /></label><label>Frequência<select value={draft.cycle} onChange={(event) => setDraft({ ...draft, cycle: event.target.value })}><option>Mensal</option><option>Trimestral</option><option>Anual</option></select></label><label>Dia de vencimento<input required type="number" min="1" max="28" value={draft.dueDay} onChange={(event) => setDraft({ ...draft, dueDay: event.target.value })} /></label><label>Meio de pagamento<select value={draft.method} onChange={(event) => setDraft({ ...draft, method: event.target.value })}><option>Pix</option><option>Cartão</option><option>Boleto</option><option>Transferência</option></select></label></div><div className="ns-integration-modal-note"><ShieldCheck size={15} />A assinatura é registrada localmente; nenhuma cobrança será enviada.</div><footer><button type="button" className="ns-secondary" onClick={() => setModal(false)}>Cancelar</button><button type="submit" className="ns-primary"><Check size={14} />{editing ? 'Salvar alterações' : 'Criar assinatura'}</button></footer></form></div>}
  </>;
}

const billingSeed = [];

function BillingScreen({ notify }) {
  const storageKey = 'nexo.billing.v1';
  const [items, setItems] = useState(() => { try { const saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); return Array.isArray(saved) ? saved : billingSeed; } catch { return billingSeed; } });
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todas');
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [activity, setActivity] = useState([]);
  const [draft, setDraft] = useState({ client: '', description: '', amount: '', due: new Date().toISOString().slice(0, 10), method: 'Pix', recurrence: 'Não recorrente' });
  const persist = (next) => { setItems(next); try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { notify('Não foi possível salvar as cobranças neste navegador.'); } };
  const statusOf = (item) => ['Paga', 'Cancelada'].includes(item.status) ? item.status : item.due < new Date().toISOString().slice(0, 10) ? 'Vencida' : item.status;
  const openNew = () => { setEditing(null); setDraft({ client: '', description: '', amount: '', due: new Date().toISOString().slice(0, 10), method: 'Pix', recurrence: 'Não recorrente' }); setModal(true); };
  const openEdit = (item) => { setEditing(item.id); setDraft({ client: item.client, description: item.description, amount: String(item.amount), due: item.due, method: item.method, recurrence: item.recurrence }); setModal(true); };
  const save = (event) => { event.preventDefault(); if (!draft.client.trim() || !draft.description.trim() || Number(draft.amount) <= 0) return; const old = items.find((item) => item.id === editing); const entry = { ...draft, client: draft.client.trim(), description: draft.description.trim(), amount: Number(draft.amount), id: editing || `COB-${String(Date.now()).slice(-6)}`, status: old?.status || 'Aguardando', link: old?.link || '' }; persist(editing ? items.map((item) => item.id === editing ? entry : item) : [entry, ...items]); setModal(false); notify(editing ? 'Cobrança atualizada.' : 'Cobrança criada como demonstração.'); };
  const update = (item, patch) => persist(items.map((entry) => entry.id === item.id ? { ...entry, ...patch } : entry));
  const log = (item, action) => { setActivity((current) => [{ id: `${Date.now()}`, client: item.client, action, time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }, ...current].slice(0, 5)); };
  const remind = (item) => { log(item, `Lembrete preparado para ${item.client}`); notify(`Lembrete preparado para ${item.client}. WhatsApp/e-mail será conectado no backend.`); };
  const copyLink = async (item) => { const link = item.link || `https://pagamento.exemplo.local/${item.id.toLowerCase()}`; try { await navigator.clipboard.writeText(link); } catch { /* clipboard can be unavailable in embedded previews */ } update(item, { link }); log(item, 'Link de pagamento copiado (demonstração)'); notify('Link de demonstração copiado; nenhuma cobrança real foi criada.'); };
  const cancel = (item) => { if (!window.confirm(`Cancelar a cobrança de ${money(item.amount)} para ${item.client}?`)) return; update(item, { status: 'Cancelada' }); notify('Cobrança cancelada localmente.'); };
  const remove = (item) => { if (!window.confirm(`Excluir o registro local ${item.id}?`)) return; persist(items.filter((entry) => entry.id !== item.id)); notify('Registro removido.'); };
  const normalized = items.map((item) => ({ ...item, displayStatus: statusOf(item) }));
  const open = normalized.filter((item) => !['Paga', 'Cancelada'].includes(item.displayStatus));
  const overdue = open.filter((item) => item.displayStatus === 'Vencida');
  const dueSoon = open.filter((item) => item.displayStatus !== 'Vencida' && item.due <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  const shown = normalized.filter((item) => (filter === 'Todas' || item.displayStatus === filter) && `${item.id} ${item.client} ${item.description}`.toLowerCase().includes(query.toLowerCase()));
  const dateLabel = (date) => new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  return <>
    <div className="ns-metrics ns-metrics-three"><Metric label="Em aberto" value={money(open.reduce((sum, item) => sum + Number(item.amount), 0))} note={`${open.length} cobranças aguardando`} icon={CircleDollarSign} /><Metric label="Vencidas" value={money(overdue.reduce((sum, item) => sum + Number(item.amount), 0))} note={`${overdue.length} precisam de atenção`} icon={AlertCircle} /><Metric label="Vencem em 7 dias" value={`${dueSoon.length} cobranças`} note={money(dueSoon.reduce((sum, item) => sum + Number(item.amount), 0))} icon={CalendarClock} /></div>
    <div className="ns-section-heading"><div><h2>Cobranças de clientes</h2><p>Crie registros, acompanhe vencimentos e prepare lembretes.</p></div><button className="ns-primary" type="button" onClick={openNew}><Plus size={15} />Nova cobrança</button></div>
    <section className="ns-panel ns-billing-panel"><div className="ns-billing-toolbar"><nav className="ns-filter-tabs">{['Todas', 'Aguardando', 'Enviada', 'Vencida', 'Paga', 'Cancelada'].map((item) => <button type="button" key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item}</button>)}</nav><label className="ns-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cliente ou cobrança" /></label></div>
      <div className="ns-table-scroll"><table className="ns-table ns-billing-table"><thead><tr><th>Cobrança</th><th>Cliente</th><th>Vencimento</th><th>Valor</th><th>Meio / ciclo</th><th>Status</th><th>Ações</th></tr></thead><tbody>{shown.map((item) => <tr key={item.id}><td><b className="ns-row-id">{item.id}</b><small className="ns-billing-description">{item.description}</small></td><td>{item.client}</td><td>{dateLabel(item.due)}</td><td><b>{money(Number(item.amount))}</b></td><td>{item.method}<small className="ns-billing-description">{item.recurrence}</small></td><td><Status>{item.displayStatus}</Status></td><td><div className="ns-billing-actions"><IconButton label={`Editar ${item.id}`} onClick={() => openEdit(item)}><Pencil size={15} /></IconButton><IconButton label={`Copiar link de pagamento de ${item.id}`} onClick={() => copyLink(item)}><Copy size={15} /></IconButton><IconButton label={`Preparar lembrete para ${item.client}`} onClick={() => remind(item)} disabled={['Paga', 'Cancelada'].includes(item.displayStatus)}><Send size={15} /></IconButton>{item.displayStatus !== 'Paga' && item.displayStatus !== 'Cancelada' && <IconButton label={`Registrar pagamento de ${item.id}`} onClick={() => { update(item, { status: 'Paga', paidAt: new Date().toISOString() }); notify('Pagamento registrado localmente.'); }}><Check size={15} /></IconButton>}{!['Paga', 'Cancelada'].includes(item.displayStatus) && <IconButton label={`Cancelar ${item.id}`} onClick={() => cancel(item)}><X size={15} /></IconButton>}<IconButton label={`Excluir ${item.id}`} onClick={() => remove(item)}><Trash2 size={15} /></IconButton></div></td></tr>)}{!shown.length && <tr><td colSpan="7" className="ns-empty">Nenhuma cobrança encontrada.</td></tr>}</tbody></table></div><div className="ns-table-footer"><span>Mostrando {shown.length} de {items.length} cobranças</span><span>Registros locais · não envia pagamentos</span></div>
    </section>
    <section className="ns-billing-bottom"><div className="ns-info-note"><ShieldCheck size={17} /><span>Os registros ficam salvos neste navegador. Links, lembretes e baixas são demonstrações; Mercado Pago e WhatsApp serão ligados na etapa de backend.</span></div><section className="ns-panel ns-billing-activity"><div className="ns-panel-title"><div><h2>Atividade recente</h2><p>Ações desta sessão</p></div><Activity size={17} /></div>{activity.length ? activity.map((entry) => <div className="ns-billing-activity-row" key={entry.id}><CheckCircle2 size={14} /><span>{entry.action}<small>{entry.client}</small></span><time>{entry.time}</time></div>) : <p className="ns-empty-history">Nenhuma ação recente nesta sessão.</p>}</section></section>
    {modal && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false); }}><form className="ns-integration-modal ns-billing-modal" onSubmit={save}><header><span className="ns-integration-logo mercado"><CircleDollarSign size={18} /></span><div><h2>{editing ? 'Editar cobrança' : 'Nova cobrança'}</h2><p>Registre os dados para acompanhar o recebimento.</p></div><button type="button" aria-label="Fechar" onClick={() => setModal(false)}><X size={17} /></button></header><div className="ns-integration-fields"><label>Cliente<input autoFocus required value={draft.client} onChange={(event) => setDraft({ ...draft, client: event.target.value })} placeholder="Nome do cliente" /></label><label>Descrição<input required value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Ex.: Desenvolvimento do site" /></label><label>Valor<input required type="number" min="0.01" step="0.01" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="1500,00" /></label><label>Vencimento<input required type="date" value={draft.due} onChange={(event) => setDraft({ ...draft, due: event.target.value })} /></label><label>Meio de pagamento<select value={draft.method} onChange={(event) => setDraft({ ...draft, method: event.target.value })}><option>Pix</option><option>Cartão</option><option>Boleto</option><option>Transferência</option></select></label><label>Recorrência<select value={draft.recurrence} onChange={(event) => setDraft({ ...draft, recurrence: event.target.value })}><option>Não recorrente</option><option>Mensal</option><option>Trimestral</option><option>Anual</option></select></label></div><div className="ns-integration-modal-note"><ShieldCheck size={15} />Somente registro local. O Mercado Pago não será acionado.</div><footer><button type="button" className="ns-secondary" onClick={() => setModal(false)}>Cancelar</button><button type="submit" className="ns-primary"><Check size={14} />{editing ? 'Salvar alterações' : 'Criar cobrança'}</button></footer></form></div>}
  </>;
}

function FinanceList({ page, notify }) {
  const titles = { receitas: ['Lançamento', 'Cliente / descrição', 'Vencimento', 'Valor', 'Status'], despesas: ['Lançamento', 'Fornecedor / categoria', 'Vencimento', 'Valor', 'Status'], cobrancas: ['Cobrança', 'Cliente / descrição', 'Vencimento', 'Valor', 'Status'] };
  const storageKey = `nexo.finance.${page}.v1`;
  const [rows, setRows] = useState(() => { try { const saved = JSON.parse(localStorage.getItem(storageKey) || 'null'); return Array.isArray(saved) ? saved : financeRows[page]; } catch { return financeRows[page]; } });
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const verb = page === 'despesas' ? 'Nova despesa' : page === 'cobrancas' ? 'Nova cobrança' : 'Nova receita';
  const persist = (next) => { setRows(next); localStorage.setItem(storageKey, JSON.stringify(next)); };
  const amountNumber = (row) => Number(String(row[4]).replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
  const submit = (event) => { event.preventDefault(); const value = Number(amount.replace(',', '.')); if (!name.trim() || !value) { notify('Preencha a descrição e um valor válido'); return; } const next = [[`${page.slice(0, 3).toUpperCase()}-${String(Date.now()).slice(-5)}`, name.trim(), 'Lançamento manual', new Date().toLocaleDateString('pt-BR'), money(value), page === 'despesas' ? 'Pendente' : 'Pendente'], ...rows]; persist(next); setName(''); setAmount(''); setFormOpen(false); notify(`${verb} adicionada e salva neste navegador.`); };
  const doAction = (message) => { const id = message.replace('Opções de ', ''); const target = rows.find((row) => row[0] === id); if (!target) return notify(message); if (window.confirm(`${target[5] === 'Pendente' || target[5] === 'Aguardando' ? 'Marcar como pago/recebido' : 'Remover'} “${target[1]}” (${target[4]})?`)) { if (target[5] === 'Pendente' || target[5] === 'Aguardando') persist(rows.map((row) => row[0] === id ? [...row.slice(0, 5), page === 'despesas' ? 'Paga' : 'Recebida'] : row)); else persist(rows.filter((row) => row[0] !== id)); notify('Lançamento atualizado localmente.'); } };
  const total = rows.reduce((sum, row) => sum + amountNumber(row), 0);
  const pending = rows.filter((row) => ['Pendente', 'Aguardando'].includes(row[5]));
  const delayed = rows.filter((row) => row[5] === 'Atrasada' || row[5] === 'Vencida');
  return <><div className="ns-metrics ns-metrics-three"><Metric label={page === 'despesas' ? 'Despesas registradas' : 'Receitas registradas'} value={money(total)} note={`${rows.length} lançamentos locais`} icon={page === 'despesas' ? ArrowUpRight : ArrowDownLeft} /><Metric label="Aguardando" value={money(pending.reduce((sum, row) => sum + amountNumber(row), 0))} note={`${pending.length} lançamentos pendentes`} icon={Clock3} /><Metric label="Em atraso" value={money(delayed.reduce((sum, row) => sum + amountNumber(row), 0))} note={`${delayed.length} precisam de atenção`} icon={AlertCircle} /></div>{formOpen && <form className="ns-inline-form" onSubmit={submit}><div><b>{verb}</b><small>Os registros ficam neste navegador</small></div><input aria-label="Descrição ou cliente" required placeholder="Descrição ou cliente" value={name} onChange={(event) => setName(event.target.value)} /><input aria-label="Valor" required type="number" min="0.01" step="0.01" placeholder="Valor (ex.: 850,00)" value={amount} onChange={(event) => setAmount(event.target.value)} /><button className="ns-primary" type="submit"><Check size={15} />Salvar</button><IconButton label="Fechar formulário" onClick={() => setFormOpen(false)}><X size={16} /></IconButton></form>}<DataTable columns={titles[page]} rows={rows} search onAction={doAction} /><div className="ns-page-bottom"><span><ShieldCheck size={15} /> Clique nas opções de um lançamento para baixar ou remover localmente</span><button className="ns-secondary" type="button" onClick={() => setFormOpen((open) => !open)}><Plus size={15} />{verb}</button></div></>;
}

function Inbox({ notify, forceWhatsapp = false }) {
  const [messages, setMessages] = useStoredArray('nexo.support.conversations.v1', initialMessages);
  const [selected, setSelected] = useState(0);
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('Todas');
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState(forceWhatsapp ? 'WhatsApp' : 'WhatsApp');
  const [newOpen, setNewOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', company: '', phone: '', email: '' });
  const [attachment, setAttachment] = useState('');
  const [owner, setOwner] = useState('GS');
  const current = messages[selected] || messages[0];
  const selectConversation = (index) => { setSelected(index); setMessages((items) => items.map((item, i) => i === index ? { ...item, unread: 0 } : item)); };
  const send = (event) => { event.preventDefault(); if ((!draft.trim() && !attachment) || !current) return; const text = draft.trim() || 'Arquivo enviado'; const entry = { side: 'sent', text, time: 'agora', attachment: attachment || '' }; setMessages((items) => items.map((item, index) => index === selected ? { ...item, text, time: 'agora', unread: 0, channel, owner, history: [...(item.history || []), entry] } : item)); try { const events = JSON.parse(localStorage.getItem('nexo.workflow.events') || '[]'); localStorage.setItem('nexo.workflow.events', JSON.stringify([{ type: 'mensagem-enviada', title: text, client: current.company, at: new Date().toISOString() }, ...events])); } catch {} setDraft(''); setAttachment(''); notify('Mensagem registrada no historico local. O envio externo precisa do backend.'); };
  const createConversation = (event) => { event.preventDefault(); if (!newContact.name.trim() || !newContact.company.trim()) return; const item = { ...newContact, initials: newContact.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), time: 'agora', text: 'Conversa iniciada', unread: 0, color: 'blue', channel, owner, history: [] }; setMessages((items) => [item, ...items]); setSelected(0); setNewOpen(false); setNewContact({ name: '', company: '', phone: '', email: '' }); notify('Conversa adicionada ao inbox local.'); };
  const shown = messages.map((item, index) => ({ ...item, index })).filter((item) => `${item.name} ${item.company} ${item.text}`.toLowerCase().includes(query.toLowerCase())).filter((item) => filter === 'Todas' || (filter === 'Nao lidas' ? item.unread > 0 : item.unread === 0));
  const history = current?.history?.length ? current.history : [{ side: 'received', text: current?.text || '', time: current?.time || '' }];
  const createTask = () => { if (!current) return; try { const tasks = JSON.parse(localStorage.getItem('nexo.work.tasks.v1') || '[]'); localStorage.setItem('nexo.work.tasks.v1', JSON.stringify([{ id: Date.now(), title: `Retornar para ${current.name}`, project: 'Atendimento', client: current.company, due: 'A definir', assignee: owner, status: 'A fazer', priority: 'Normal' }, ...tasks])); notify('Tarefa de retorno criada e vinculada ao cliente.'); } catch { notify('Nao foi possivel salvar a tarefa.'); } };
  return <div className="ns-inbox-layout"><aside className="ns-inbox-list"><div className="ns-inbox-top"><div className="ns-channel-switch"><button className={channel === 'WhatsApp' ? 'active' : ''} onClick={() => setChannel('WhatsApp')}><MessageCircle size={15} />WhatsApp <span>{messages.length}</span></button><button className={channel === 'E-mail' ? 'active' : ''} onClick={() => setChannel('E-mail')}><Mail size={15} /></button></div><IconButton label="Nova conversa" onClick={() => setNewOpen(true)}><Plus size={17} /></IconButton></div><label className="ns-search ns-inbox-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conversa" /></label><div className="ns-filter-tabs compact">{['Todas', 'Nao lidas'].map((item) => <button type="button" key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="ns-conversation-list">{shown.map((item) => <button type="button" onClick={() => selectConversation(item.index)} className={`ns-conversation ${selected === item.index ? 'active' : ''}`} key={`${item.name}-${item.index}`}><span className={`ns-avatar ${item.color}`}>{item.initials}</span><span className="ns-conversation-copy"><span><b>{item.name}</b><small>{item.time}</small></span><small>{item.company}</small><span className="ns-preview">{item.text}</span></span>{item.unread > 0 && <i className="ns-unread">{item.unread}</i>}</button>)}</div>{shown.length === 0 && <p className="ns-empty-history">Nenhuma conversa encontrada.</p>}</aside><section className="ns-chat"><header className="ns-chat-header"><div className="ns-chat-person"><span className={`ns-avatar ${current?.color}`}>{current?.initials}</span><span><b>{current?.name || 'Selecione uma conversa'}</b><small>{current?.company} ? {channel}</small></span></div><div className="ns-chat-actions"><IconButton label="Ligar" onClick={() => notify('Chamada de voz requer uma integracao conectada.')}><Smartphone size={16} /></IconButton><IconButton label="Mais opcoes" onClick={() => notify(`Conversa com ${current?.name || 'cliente'} ? ${current?.phone || 'telefone nao informado'}`)}><MoreHorizontal size={18} /></IconButton></div></header><div className="ns-chat-context"><span className="ns-online-dot" />Historico local <span>?</span><button type="button" onClick={() => { window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Clientes' })); notify('Abra a ficha do cliente para consultar os dados completos.'); }}>Ver cliente <ExternalLink size={12} /></button></div><div className="ns-chat-history"><div className="ns-date-divider"><span>Hoje</span></div>{history.map((message, index) => <div className={`ns-message ${message.side}`} key={`${message.time}-${index}`}>{message.text}{message.attachment && <small><Paperclip size={11}/>{message.attachment}</small>}<small>{message.time}{message.side === 'sent' && <Check size={12} />}</small></div>)}</div><form className="ns-compose" onSubmit={send}><label className="ns-attach-control" title="Anexar arquivo"><Plus size={18}/><input type="file" onChange={(event) => setAttachment(event.target.files?.[0]?.name || '')}/></label><input aria-label="Escrever mensagem" placeholder={`Escreva uma mensagem via ${channel}...`} value={draft} onChange={(event) => setDraft(event.target.value)} /><button className="ns-send" aria-label="Registrar mensagem" type="submit"><Send size={16} /></button></form><footer className="ns-chat-foot">Historico salvo localmente <span>{channel} ? envio real requer backend <i /></span></footer></section><aside className="ns-contact-panel"><div className="ns-contact-profile"><span className={`ns-avatar large ${current?.color}`}>{current?.initials}</span><b>{current?.name}</b><small>{current?.company}</small><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Clientes' }))}>Ver cadastro <ChevronRight size={14} /></button></div><div className="ns-contact-block"><span>Contato</span><b>{current?.phone || 'Telefone nao informado'}</b><small>{current?.email || 'E-mail nao informado'}</small></div><div className="ns-contact-block"><span>Responsavel</span><select aria-label="Responsavel pelo atendimento" value={owner} onChange={(event) => setOwner(event.target.value)}><option>GS</option><option>AM</option><option>LC</option><option>RN</option></select></div><button type="button" className="ns-link-task" onClick={createTask}><Plus size={15} />Criar tarefa de retorno</button></aside>
    {newOpen && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNewOpen(false); }}><form className="ns-integration-modal" onSubmit={createConversation}><header><span className="ns-integration-logo"><MessageCircle size={18}/></span><div><h2>Nova conversa</h2><p>Adicione o contato para acompanhar o atendimento.</p></div><button type="button" aria-label="Fechar" onClick={() => setNewOpen(false)}><X size={17}/></button></header><div className="ns-integration-fields"><label>Nome<input autoFocus required value={newContact.name} onChange={(event) => setNewContact({ ...newContact, name: event.target.value })}/></label><label>Empresa / cliente<input required value={newContact.company} onChange={(event) => setNewContact({ ...newContact, company: event.target.value })}/></label><label>Telefone<input value={newContact.phone} onChange={(event) => setNewContact({ ...newContact, phone: event.target.value })}/></label><label>E-mail<input type="email" value={newContact.email} onChange={(event) => setNewContact({ ...newContact, email: event.target.value })}/></label></div><div className="ns-integration-modal-note"><ShieldCheck size={15}/>Conversa demonstrativa; o canal escolhido ainda nao esta conectado.</div><footer><button className="ns-secondary" type="button" onClick={() => setNewOpen(false)}>Cancelar</button><button className="ns-primary" type="submit"><Check size={14}/>Adicionar</button></footer></form></div>}</div>;
}

function Tickets({ notify }) {
  const [rows, setRows] = useStoredArray('nexo.support.tickets.v1', initialTickets);
  const [form, setForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState({ title: '', client: '', priority: 'Media', owner: 'GS', detail: '' });
  const [edit, setEdit] = useState({ status: '', owner: '', priority: '', detail: '' });
  const addTicket = (event) => { event.preventDefault(); if (!draft.title.trim() || !draft.client.trim()) { notify('Informe a solicita??o e o cliente.'); return; } const row = [`#NX-${String(Date.now()).slice(-4)}`, draft.title.trim(), draft.client.trim(), draft.priority, 'Aberto', 'agora', draft.detail.trim(), draft.owner.trim() || 'GS']; setRows((items) => [row, ...items]); setDraft({ title: '', client: '', priority: 'Media', owner: 'GS', detail: '' }); setForm(false); notify('Ticket criado e salvo localmente.'); };
  const openTicket = (label) => { const row = rows.find((item) => label.includes(item[0])); if (!row) return notify(label); setSelected(row); setEdit({ status: row[4], owner: row[7] || 'GS', priority: row[3], detail: row[6] || '' }); };
  const saveTicket = (event) => { event.preventDefault(); setRows((items) => items.map((row) => row[0] === selected[0] ? [...row.slice(0, 3), edit.priority, edit.status, 'agora', edit.detail, edit.owner] : row)); setSelected(null); notify('Ticket atualizado no historico local.'); };
  const cards = [['Abertos', rows.filter((row) => row[4] === 'Aberto').length, 'blue'], ['Em andamento', rows.filter((row) => row[4] === 'Em andamento').length, 'purple'], ['Aguardando cliente', rows.filter((row) => row[4] === 'Aguardando cliente').length, 'orange'], ['Resolvidos', rows.filter((row) => row[4] === 'Resolvido').length, 'green']];
  return <><div className="ns-ticket-stats">{cards.map(([label, value, color]) => <article key={label}><span className={`ns-stat-mark ${color}`} /><span>{label}</span><b>{value}</b></article>)}</div>{form && <form className="ns-inline-form ns-ticket-compose" onSubmit={addTicket}><div><b>Novo ticket</b><small>Registre a solicita??o e atribua um responsavel</small></div><input aria-label="Resumo do ticket" required placeholder="O que precisa ser resolvido?" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /><input aria-label="Cliente" required placeholder="Cliente" value={draft.client} onChange={(event) => setDraft({ ...draft, client: event.target.value })} /><select aria-label="Prioridade" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}><option>Baixa</option><option>Media</option><option>Alta</option><option>Urgente</option></select><input aria-label="Respons?vel" placeholder="Respons?vel" value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} /><button className="ns-primary" type="submit"><Check size={15} />Criar ticket</button><IconButton label="Fechar formulario" onClick={() => setForm(false)}><X size={16} /></IconButton></form>}<div className="ns-section-heading"><div><h2>Fila de atendimento</h2><p>Abra um ticket para atualizar prioridade, responsavel, status e detalhes.</p></div><button className="ns-secondary" type="button" onClick={() => setForm((value) => !value)}><Plus size={15} />Novo ticket</button></div><DataTable columns={['Ticket', 'Solicitacao', 'Cliente', 'Prioridade', 'Status', 'Atualizado']} rows={rows} search onAction={openTicket} statusIndex={4} />
    {selected && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><form className="ns-integration-modal" onSubmit={saveTicket}><header><span className="ns-integration-logo"><LifeBuoy size={18}/></span><div><h2>{selected[0]} ? {selected[1]}</h2><p>{selected[2]} | criado {selected[5]}</p></div><button type="button" aria-label="Fechar" onClick={() => setSelected(null)}><X size={17}/></button></header><div className="ns-integration-fields"><label>Status<select value={edit.status} onChange={(event) => setEdit({ ...edit, status: event.target.value })}>{['Aberto','Em andamento','Aguardando cliente','Resolvido'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Prioridade<select value={edit.priority} onChange={(event) => setEdit({ ...edit, priority: event.target.value })}>{['Baixa','Media','Alta','Urgente'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Respons?vel<input value={edit.owner} onChange={(event) => setEdit({ ...edit, owner: event.target.value })}/></label><label>Cliente<input readOnly value={selected[2]}/></label><label className="wide">Descricao<textarea rows="4" value={edit.detail} onChange={(event) => setEdit({ ...edit, detail: event.target.value })} placeholder="Contexto, passos para reproduzir e solucao"/></label></div><footer><button className="ns-secondary" type="button" onClick={() => setSelected(null)}>Cancelar</button><button className="ns-primary" type="submit"><Check size={14}/>Salvar ticket</button></footer></form></div>}
  </>;
}

function Sites({ page, notify }) {
  const [assetsState, setAssetsState] = useStoredArray('nexo.sites.assets.v1', assets);
  const [assetModal, setAssetModal] = useState(false);
  const [assetDraft, setAssetDraft] = useState({ name: '', client: '', type: 'Domínio + hospedagem', renewal: '' });
  const visible = page === 'dominios' ? assetsState.filter((asset) => asset.type.includes('Domínio')) : page === 'hospedagens' ? assetsState.filter((asset) => asset.type.toLowerCase().includes('hospedagem')) : assetsState;
  const addAsset = (event) => { event.preventDefault(); if (!assetDraft.name.trim() || !assetDraft.client.trim()) return; setAssetsState((current) => [{ ...assetDraft, name: assetDraft.name.trim(), client: assetDraft.client.trim(), renewal: assetDraft.renewal ? new Date(`${assetDraft.renewal}T12:00:00`).toLocaleDateString('pt-BR') : 'A definir', health: 'Atenção', icon: assetDraft.type.toLowerCase().includes('hospedagem') ? HardDrive : Globe2 }, ...current]); setAssetModal(false); setAssetDraft({ name: '', client: '', type: 'Domínio + hospedagem', renewal: '' }); notify('Ativo cadastrado e salvo localmente.'); };
  const rows = visible.map((asset) => [asset.name, asset.client, asset.type, asset.renewal, asset.health]);
  const [expanded, setExpanded] = useState('');
  const [monitorsState, setMonitorsState] = useStoredArray('nexo.sites.monitors.v1', monitors);
  if (page === 'monitoramento') return <><div className="ns-metrics ns-metrics-three"><Metric label="Sites cadastrados" value={String(monitorsState.length)} note="neste workspace" icon={Activity} /><Metric label="Disponibilidade" value="—" note="sem provedor conectado" icon={TrendingUp} /><Metric label="Incidentes" value={String(monitorsState.filter((item) => item.status === 'Offline').length)} note="dos checks registrados" icon={AlertCircle} /></div><div className="ns-monitor-list">{monitorsState.map((item) => <article className="ns-monitor-row" key={item.id}><span className="ns-monitor-pulse"><i /></span><span className="ns-monitor-main"><b>{item.name || item.url}</b><small>{item.url || item.detail}</small></span><span className="ns-monitor-status">{item.status || 'Sem verificação'}</span><span className="ns-monitor-data"><small>Última verificação</small><b>{item.checkedAt ? new Date(item.checkedAt).toLocaleString('pt-BR') : '—'}</b></span><span className="ns-monitor-data"><small>Disponibilidade</small><b>{item.uptime || '—'}</b></span></article>)}{monitorsState.length === 0 && <div className="ns-empty-history">Nenhum site monitorado. Cadastre um domínio e conecte um provedor de uptime em Integrações.</div>}</div><div className="ns-info-note"><ShieldCheck size={17} /><span>Não há verificações automáticas ativas nesta conta. Os indicadores só serão exibidos depois de conectar um serviço de monitoramento.</span><button type="button" onClick={() => navigateTo('Integrações')}>Ver integrações</button></div></>;
  return <><div className="ns-metrics ns-metrics-three"><Metric label="Ativos cadastrados" value={String(visible.length).padStart(2, '0')} note="Entre sites, domínios e hospedagens" icon={Globe2} /><Metric label="Renovações em 30 dias" value={String(visible.filter((item) => item.health.includes('Renova')).length)} note="Confira as datas cadastradas" icon={CalendarClock} /><Metric label="Tudo em dia" value={`${visible.filter((item) => item.health === 'Em dia').length} de ${visible.length}`} note="Sem pendências de renovação" icon={BadgeCheck} /></div><div className="ns-assets-list">{visible.map((asset) => { const Icon = asset.type.toLowerCase().includes('hospedagem') ? HardDrive : Globe2; return <article className="ns-asset-row" key={asset.name}><span className="ns-asset-icon"><Icon size={19} /></span><span className="ns-asset-main"><b>{asset.name}</b><small>{asset.client}</small></span><span className="ns-asset-type">{asset.type}</span><span className="ns-asset-renew"><small>Renovação</small><b>{asset.renewal}</b></span><Status>{asset.health}</Status><IconButton label={`Detalhes de ${asset.name}`} onClick={() => setExpanded(expanded === asset.name ? '' : asset.name)}><ChevronDown size={16} /></IconButton>{expanded === asset.name && <div className="ns-asset-detail"><span>Responsável <b>Equipe Nexo</b></span><span>DNS <b>Gerenciado</b></span><span>Renovação automática <b>Não configurada</b></span><button type="button" onClick={() => { if (!window.confirm(`Remover ${asset.name} dos ativos locais?`)) return; setAssetsState((current) => current.filter((entry) => entry.name !== asset.name)); notify('Ativo removido.'); }}>Remover <Trash2 size={13} /></button></div>}</article>; })}</div><div className="ns-page-bottom"><span><Cloud size={15} /> Cadastro local de sites, domínios e hospedagens</span><button className="ns-secondary" type="button" onClick={() => setAssetModal(true)}><Plus size={15} />Adicionar ativo</button></div><div className="ns-info-note"><ShieldCheck size={17} /><span>Monitoramento de uptime, SSL e renovações reais exige integração no backend.</span></div>{assetModal && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setAssetModal(false); }}><form className="ns-integration-modal" onSubmit={addAsset}><header><span className="ns-integration-logo google"><Globe2 size={18} /></span><div><h2>Adicionar ativo</h2><p>Registre um domínio, hospedagem ou site do cliente.</p></div><button type="button" aria-label="Fechar" onClick={() => setAssetModal(false)}><X size={17} /></button></header><div className="ns-integration-fields"><label>Domínio ou nome<input required autoFocus value={assetDraft.name} onChange={(e) => setAssetDraft({ ...assetDraft, name: e.target.value })} placeholder="exemplo.com.br" /></label><label>Cliente<input required value={assetDraft.client} onChange={(e) => setAssetDraft({ ...assetDraft, client: e.target.value })} placeholder="Nome do cliente" /></label><label>Tipo<select value={assetDraft.type} onChange={(e) => setAssetDraft({ ...assetDraft, type: e.target.value })}><option>Domínio + hospedagem</option><option>Domínio</option><option>Hospedagem</option><option>Site</option></select></label><label>Próxima renovação<input type="date" value={assetDraft.renewal} onChange={(e) => setAssetDraft({ ...assetDraft, renewal: e.target.value })} /></label></div><div className="ns-integration-modal-note"><ShieldCheck size={15} />Cadastro local; nenhuma consulta ou renovação será feita automaticamente.</div><footer><button className="ns-secondary" type="button" onClick={() => setAssetModal(false)}>Cancelar</button><button className="ns-primary" type="submit"><Check size={14} />Salvar ativo</button></footer></form></div>}</>;
}

function Integrations({ notify }) {
  const [configs, setConfigs] = useState(() => { try { return JSON.parse(localStorage.getItem('nexo.integrations.configs') || '{}'); } catch { return {}; } });
  const [selected, setSelected] = useState(null);
  const [values, setValues] = useState({});
  const [testResult, setTestResult] = useState('');
  const [filter, setFilter] = useState('Todas');
  const categories = ['Todas', 'Pagamentos', 'WhatsApp', 'E-mail', 'Produtividade', 'Desenvolvimento', 'Automações', 'Monitoramento'];
  const providerCategory = (name) => name === 'Mercado Pago' ? 'Pagamentos' : ['Evolution API', 'WAHA'].includes(name) ? 'WhatsApp' : name === 'Resend' ? 'E-mail' : name === 'Google Workspace' ? 'Produtividade' : name === 'GitHub' ? 'Desenvolvimento' : name === 'n8n' ? 'Automações' : 'Monitoramento';
  const visible = integrations.filter((item) => filter === 'Todas' || providerCategory(item.name) === filter);
  const configuredCount = Object.values(configs).filter((config) => config.configured).length;
  const openConfig = (provider) => { setSelected(provider); setValues(configs[provider.name]?.values || {}); setTestResult(''); };
  const saveConfig = (event) => {
    event.preventDefault();
    const safeValues = Object.fromEntries(selected.fields.filter(([, , secret]) => !secret).map(([key]) => [key, values[key] || '']));
    const next = { ...configs, [selected.name]: { configured: true, values: safeValues, updatedAt: new Date().toISOString() } };
    setConfigs(next);
    try { localStorage.setItem('nexo.integrations.configs', JSON.stringify(next)); } catch { notify('Não foi possível salvar esta configuração no navegador.'); return; }
    setSelected(null); notify(`${selected.name}: configuração salva localmente. O serviço ainda não foi conectado.`);
  };
  const disconnect = (provider) => {
    if (!window.confirm(`Remover a configuração local de ${provider.name}?`)) return;
    const next = { ...configs }; delete next[provider.name]; setConfigs(next);
    localStorage.setItem('nexo.integrations.configs', JSON.stringify(next)); notify(`${provider.name}: configuração removida.`);
  };
  const testConfig = (provider) => {
    setTestResult(`${provider.name}: campos salvos. O teste real ficará disponível quando o backend estiver conectado.`);
  };
  return <>
    <div className="ns-integration-intro"><span><Link2 size={18} /></span><div><b>Suas ferramentas, conectadas ao trabalho</b><small>{configuredCount} de {integrations.length} configurações preenchidas neste navegador. Ainda não existe conexão com os provedores.</small></div><button type="button" onClick={() => { setConfigs(() => { try { return JSON.parse(localStorage.getItem('nexo.integrations.configs') || '{}'); } catch { return {}; } }); notify('Configurações locais atualizadas.'); }}><RefreshCw size={15} />Atualizar</button></div>
    <div className="ns-integration-filters">{categories.map((item) => <button type="button" className={filter === item ? 'active' : ''} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div>
    <div className="ns-integration-grid">{visible.map((item) => { const Icon = item.icon; const configured = Boolean(configs[item.name]?.configured); return <article className="ns-integration-card" key={item.name}><div className="ns-integration-top"><span className={`ns-integration-logo ${item.color}`}><Icon size={20} /></span><span className={`ns-connection-badge ${configured ? 'configured' : ''}`}><i />{configured ? 'Configurada' : 'Não conectada'}</span></div><h3>{item.name}</h3><p>{item.detail}</p><div className="ns-integration-actions"><button type="button" onClick={() => openConfig(item)}><Settings2 size={14} />{configured ? 'Editar configuração' : 'Configurar'}</button>{configured && <button type="button" className="ns-link-button" onClick={() => testConfig(item)}>Testar</button>}{configured && <button type="button" className="ns-link-button danger" onClick={() => disconnect(item)}>Remover</button>}</div></article>; })}</div>
    {testResult && <div className="ns-info-note" role="status"><CheckCircle2 size={17} /><span>{testResult}</span></div>}
    <div className="ns-info-note"><ShieldCheck size={17} /><span>Campos secretos são descartados ao salvar e nunca ficam no localStorage. A ligação real por OAuth, API e webhooks será feita após criar o backend.</span></div>
    {selected && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><form className="ns-integration-modal" onSubmit={saveConfig}><header><span className={`ns-integration-logo ${selected.color}`}><selected.icon size={20} /></span><div><h2>Configurar {selected.name}</h2><p>Os segredos digitados não serão salvos nem enviados.</p></div><button type="button" aria-label="Fechar" onClick={() => setSelected(null)}><X size={17} /></button></header><div className="ns-integration-fields">{selected.fields.map(([key, label, secret]) => <label key={key}>{label}<input required type={secret ? 'password' : 'text'} autoComplete="off" value={values[key] || ''} onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))} placeholder={secret ? 'Informado apenas nesta sessão' : label} /></label>)}</div><div className="ns-integration-modal-note"><ShieldCheck size={15} />Configuração local de interface. Não valide chaves reais aqui.</div><footer><button type="button" className="ns-secondary" onClick={() => setSelected(null)}>Cancelar</button><button type="submit" className="ns-primary"><Check size={14} />Salvar configuração</button></footer></form></div>}
  </>;
}

function Automations({ notify }) {
  const { records: items, create, update, remove: deleteRecord } = useWorkspaceRecords('automations');
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState({ name: '', detail: '', trigger: 'Novo lead recebido', action: 'Criar tarefa de follow-up' });
  const [runs, setRuns] = useState([]);
  const [showRuns, setShowRuns] = useState(false);
  const triggers = ['Novo lead recebido', 'Cobrança próxima do vencimento', 'Pagamento confirmado', 'Projeto concluído', 'Projeto atrasado', 'Novo ticket criado', 'Aprovação solicitada'];
  const actions = ['Criar tarefa de follow-up', 'Enviar e-mail ao cliente', 'Enviar WhatsApp ao responsável', 'Atualizar etapa do CRM', 'Criar cobrança', 'Abrir ticket de suporte', 'Notificar equipe'];
  const persist = async (next, old = []) => { try { const existing = new Map(old.map((item) => [item.id, item])); for (const item of next) { const previous = existing.get(item.id); if (previous) await update(item.id, item); else if (!item.id) await create(item); else if (!old.some((row) => row.id === item.id)) await create(Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'id'))); } for (const item of old) if (!next.some((row) => row.id === item.id)) await deleteRecord(item.id); } catch (error) { notify(error.message || 'Não foi possível salvar a automação.'); } };
  const openNew = () => { setEditing(null); setDraft({ name: '', detail: '', trigger: triggers[0], action: actions[0] }); setForm(true); };
  const openEdit = (item) => { setEditing(item.id); setDraft({ name: item.name, detail: item.detail, trigger: item.trigger, action: item.action || actions[0] }); setForm(true); };
  const saveDraft = async (event) => {
    event.preventDefault();
    if (!draft.name.trim()) { notify('Informe um nome para a automação.'); return; }
    const entry = { ...draft, name: draft.name.trim(), detail: draft.detail.trim() || `${draft.trigger} → ${draft.action}`, active: editing === null ? false : items.find((item) => item.id === editing)?.active || false };
    const next = editing === null ? [entry, ...items] : items.map((item) => item.id === editing ? { ...item, ...entry } : item);
    await persist(next, items); setForm(false); notify(editing === null ? 'Rascunho salvo no workspace. Ativação requer integração n8n.' : 'Rascunho atualizado no workspace.');
  };
  const toggle = () => notify('A execução real depende de conectar e validar o n8n em Integrações.');
  const duplicate = async (item) => { try { const { id, ...copy } = item; await create({ ...copy, name: `${item.name} (cópia)`, active: false }); notify('Cópia salva como rascunho.'); } catch (error) { notify(error.message); } };
  const remove = async (item) => { if (!window.confirm(`Excluir a automação “${item.name}”?`)) return; try { await deleteRecord(item.id); notify('Automação removida.'); } catch (error) { notify(error.message); } };

  return <>
    <div className="ns-metrics ns-metrics-three"><Metric label="Automações ativas" value={String(items.filter((item) => item.active).length).padStart(2, '0')} note={`${items.length} fluxos cadastrados`} icon={Sparkles} /><Metric label="Simulações nesta sessão" value={String(runs.length).padStart(2, '0')} note="Nenhuma ação externa executada" icon={Activity} /><Metric label="Modo de execução" value="Rascunho" note="Integração n8n pendente" icon={Clock3} /></div>
    <div className="ns-section-heading"><div><h2>Fluxos de trabalho</h2><p>Configure gatilhos e ações para as rotinas da agência.</p></div><div className="ns-automation-head-actions"><button type="button" className="ns-secondary" onClick={() => setShowRuns((value) => !value)}><Clock3 size={14} />Histórico ({runs.length})</button><button type="button" className="ns-primary" onClick={openNew}><Plus size={15} />Nova automação</button></div></div>
    {form && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setForm(false); }}><form className="ns-integration-modal ns-automation-modal" onSubmit={saveDraft}><header><span className="ns-integration-logo sign"><Sparkles size={18} /></span><div><h2>{editing === null ? 'Nova automação' : 'Editar automação'}</h2><p>Defina o evento e a resposta desejada.</p></div><button type="button" aria-label="Fechar" onClick={() => setForm(false)}><X size={17} /></button></header><div className="ns-integration-fields"><label>Nome<input autoFocus required maxLength="70" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex.: Avisar sobre novo ticket" /></label><label>Descrição<input value={draft.detail} onChange={(event) => setDraft({ ...draft, detail: event.target.value })} placeholder="O que esta automação fará?" /></label><label>Quando isso acontecer<select value={draft.trigger} onChange={(event) => setDraft({ ...draft, trigger: event.target.value })}>{triggers.map((item) => <option key={item}>{item}</option>)}</select></label><label>Então fazer<select value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value })}>{actions.map((item) => <option key={item}>{item}</option>)}</select></label></div><div className="ns-integration-modal-note"><ShieldCheck size={15} />Salvo como regra de interface. O n8n ainda não será acionado.</div><footer><button type="button" className="ns-secondary" onClick={() => setForm(false)}>Cancelar</button><button type="submit" className="ns-primary"><Check size={14} />{editing === null ? 'Criar rascunho' : 'Salvar alterações'}</button></footer></form></div>}
    <div className="ns-automation-list">{items.map((item, index) => <article className="ns-automation-row" key={`${item.name}-${index}`}><span className={`ns-flow-icon ${item.active ? 'active' : ''}`}><Sparkles size={18} /></span><span className="ns-flow-main"><b>{item.name}</b><small>{item.detail}</small></span><span className="ns-flow-trigger"><small>Quando</small><b>{item.trigger}</b></span><span className="ns-flow-run"><small>Então</small><b>{item.action || 'Ação não configurada'}</b></span><button type="button" className={`ns-toggle ${item.active ? 'on' : ''}`} role="switch" aria-checked={item.active} aria-label={`${item.active ? 'Desativar' : 'Ativar'} ${item.name}`} onClick={toggle} disabled title="Ative após conectar o n8n"><i /></button><div className="ns-automation-row-actions"><IconButton label="Configurar n8n" onClick={() => navigateTo('Integrações')}><Play size={15} /></IconButton><IconButton label={`Editar ${item.name}`} onClick={() => openEdit(item, index)}><Pencil size={15} /></IconButton><IconButton label={`Duplicar ${item.name}`} onClick={() => duplicate(item)}><Copy size={15} /></IconButton><IconButton label={`Excluir ${item.name}`} onClick={() => remove(item)}><Trash2 size={15} /></IconButton></div></article>)}</div>
    {showRuns && <section className="ns-automation-history"><div className="ns-section-heading"><div><h2>Histórico desta sessão</h2><p>Simulações executadas enquanto esta tela está aberta.</p></div><button className="ns-link-button" onClick={() => setRuns([])}>Limpar histórico</button></div>{runs.length ? runs.map((run, index) => <div className="ns-run-row" key={`${run.name}-${index}`}><CheckCircle2 size={15} /><b>{run.name}</b><span>{run.result}</span><time>{run.time}</time></div>) : <p className="ns-empty-history">Nenhuma simulação executada nesta sessão.</p>}</section>}
    <div className="ns-info-note"><Sparkles size={17} /><span>Você pode criar e revisar regras aqui. Ativar e testar são ações simuladas; o n8n será conectado depois que o backend estiver pronto.</span></div>
  </>;
}

export function ServiceScreen({ page }) {
  const currentPage = normalizePage(page);
  const [toast, setToast] = useState('');
  const [clock, setClock] = useState(0);
  const notify = (message) => { setToast(message); window.clearTimeout(clock); setClock(window.setTimeout(() => setToast(''), 2800)); };
  const newAction = currentPage === 'financeiro' ? 'Novo lançamento' : null;
  const headerAction = () => { if (currentPage === 'financeiro') navigateTo('Receitas'); };
  let activeContent;
  if (currentPage === 'financeiro') activeContent = <FinanceOverview notify={notify} />;
  else if (currentPage === 'cobrancas') activeContent = <PaymentConsole kind="orders" notify={notify} />;
  else if (['receitas', 'despesas'].includes(currentPage)) activeContent = <FinanceList page={currentPage} notify={notify} />;
  else if (currentPage === 'contas') activeContent = <Accounts notify={notify} />;
  else if (currentPage === 'assinaturas') activeContent = <PaymentConsole kind="subscriptions" notify={notify} />;
  else if (currentPage === 'caixa_entrada' || currentPage === 'whatsapp') activeContent = <Inbox notify={notify} forceWhatsapp={currentPage === 'whatsapp'} />;
  else if (currentPage === 'tickets') activeContent = <Tickets notify={notify} />;
  else if (['sites', 'dominios', 'hospedagens', 'monitoramento'].includes(currentPage)) activeContent = <Sites page={currentPage} notify={notify} />;
  else if (currentPage === 'integracoes') activeContent = <Integrations notify={notify} />;
  else activeContent = <Automations notify={notify} />;
  return <main className="ns-screen"><div className="ns-screen-inner"><PageHeading page={currentPage} action={newAction} onAction={headerAction} />{activeContent}</div><Toast message={toast} onClose={() => setToast('')} /></main>;
}

export default ServiceScreen;
