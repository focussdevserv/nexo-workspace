import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import './integration-dialog.css';
import './automations.css';
import './billing.css';
import { PaymentConsole } from './PaymentScreens.jsx';
import { apiRequest, useWorkspaceRecords } from '../lib/workspace-api.js';

function useStoredArray(key, fallback) {
  const resources = { 'nexo.finance.receitas.v1': 'revenues', 'nexo.finance.despesas.v1': 'expenses', 'nexo.finance.accounts.v1': 'finance-accounts', 'nexo.finance.transactions.v1': 'finance-transactions', 'nexo.support.conversations.v1': 'inbox', 'nexo.sites.assets.v1': 'site-assets', 'nexo.sites.monitors.v1': 'monitors' };
  const resource = resources[key];
  const path = key === 'nexo.billing.v1' ? '/api/billing/orders' : `/api/workspace/${resource}`;
  const [value, setValue] = useState([]);
  const ref = useRef(value);
  const refresh = useCallback(async () => { const result = await apiRequest(path); ref.current = result.data || []; setValue(ref.current); return ref.current; }, [path]);
  useEffect(() => { let active = true; refresh().catch((error) => { if (active) window.dispatchEvent(new CustomEvent('nexo:workspace-error', { detail: error.message })); }); return () => { active = false; }; }, [refresh]);
  const persist = (nextOrUpdater) => {
    const previous = ref.current; const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(previous) : nextOrUpdater; ref.current = next; setValue(next);
    if (!resource) { window.dispatchEvent(new CustomEvent('nexo:workspace-error', { detail: 'Este tipo de registro exige a tela de cobrança Mercado Pago.' })); return next; }
    const oldById = new Map(previous.map((item) => [String(item.id), item])); const newById = new Map(next.map((item) => [String(item.id), item]));
    const clean = (item) => Object.fromEntries(Object.entries(item).filter(([field]) => !['id','createdAt','updatedAt'].includes(field)));
    Promise.all([
      ...next.filter((item) => !oldById.has(String(item.id))).map(async (item) => { const tempId = String(item.id); const saved = await apiRequest(`/api/workspace/${resource}`, { method: 'POST', body: JSON.stringify({ data: clean(item) }) }); ref.current = ref.current.map((row) => String(row.id) === tempId || String(row.id) === String(saved.data.id) ? saved.data : row); setValue(ref.current); }),
      ...next.filter((item) => oldById.has(String(item.id)) && JSON.stringify(clean(item)) !== JSON.stringify(clean(oldById.get(String(item.id))))).map((item) => apiRequest(`/api/workspace/${resource}/${item.id}`, { method: 'PATCH', body: JSON.stringify({ data: clean(item) }) })),
      ...previous.filter((item) => !newById.has(String(item.id))).map((item) => apiRequest(`/api/workspace/${resource}/${item.id}`, { method: 'DELETE' })),
    ]).catch((error) => window.dispatchEvent(new CustomEvent('nexo:workspace-error', { detail: error.message })));
    return next;
  };
  return [value, persist, refresh];
}

const initialMessages = [];


const assets = [];

const monitors = [];

const integrations = [
  { name: 'Mercado Pago', detail: 'Cobranças, pagamentos e recorrências', icon: CreditCard, color: 'mercado', fields: [['accessToken', 'Access token', true], ['publicKey', 'Public key', false]] },
  { name: 'Evolution API', detail: 'Instâncias, conversas e notificações WhatsApp', icon: MessageCircle, color: 'whatsapp', fields: [['baseUrl', 'URL da API', false], ['instance', 'Nome da instância', false], ['apiKey', 'API key', true]] },
  { name: 'WAHA', detail: 'Sessões WhatsApp e mensagens', icon: Smartphone, color: 'whatsapp', fields: [['baseUrl', 'URL da API', false], ['session', 'Nome da sessão', false], ['apiKey', 'API key', true]] },
  { name: 'Resend', detail: 'E-mails de propostas e notificações', icon: Mail, color: 'google', fields: [['apiKey', 'API key', true], ['fromEmail', 'E-mail remetente', false]] },
  { name: 'Google Workspace', detail: 'Gmail, Calendar, Drive e Meet', icon: CalendarClock, color: 'google', fields: [['clientId', 'OAuth client ID', false], ['redirectUri', 'URL de retorno', false]] },
  { name: 'Clicksign', detail: 'Assinatura eletrônica de contratos', icon: FileText, color: 'sign', fields: [['apiToken', 'Token da API', true]] },
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
  const [revenues] = useStoredArray('nexo.finance.receitas.v1', []);
  const [expenses] = useStoredArray('nexo.finance.despesas.v1', []);
  const [billing] = useStoredArray('nexo.billing.v1', []);
  const [accounts] = useStoredArray('nexo.finance.accounts.v1', []);
  const parseAmount = (value) => Number(String(value ?? '').replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  const sumRows = (rows) => rows.reduce((sum, row) => sum + parseAmount(Array.isArray(row) ? row[4] : row.amount), 0);
  const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);
  const openBills = billing.filter((bill) => !['Paga', 'Cancelada'].includes(bill.status));
  const recent = [...revenues.map((row) => [row[0], row[1], row[3], `+ ${row[4]}`, row[5]]), ...expenses.map((row) => [row[0], row[1], row[3], `− ${row[4]}`, row[5]])].slice(0, 8);
  return <>
    <div className="ns-metrics ns-metrics-four"><Metric label="Saldo registrado" value={money(totalBalance)} note={`${accounts.length} contas cadastradas`} icon={Wallet} /><Metric label="Receitas cadastradas" value={money(sumRows(revenues))} note={`${revenues.length} lançamentos`} icon={ArrowDownLeft} /><Metric label="Despesas cadastradas" value={money(sumRows(expenses))} note={`${expenses.length} lançamentos`} icon={ArrowUpRight} /><Metric label="A receber" value={money(openBills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0))} note={`${openBills.length} cobranças abertas`} icon={Clock3} /></div>
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
  const [transactions, setTransactions] = useStoredArray('nexo.finance.transactions.v1', []);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState('Todas');
  const [draft, setDraft] = useState({ name: '', bank: '', balance: '0' });
  const saveList = (next) => { setAccounts(next);  };
  const saveTransactionList = (next) => { setTransactions(next);  };
  const openNew = () => { setEditing(null); setDraft({ name: '', bank: '', balance: '0' }); setModal(true); };
  const openEdit = (account) => { setEditing(account.name); setDraft({ name: account.name, bank: account.bank, balance: String(account.balance) }); setModal(true); };
  const save = (event) => { event.preventDefault(); if (!draft.name.trim() || !draft.bank.trim()) return; const previous = accounts.find((account) => account.name === editing); const entry = { id: previous?.id || globalThis.crypto?.randomUUID?.() || `account-${Date.now()}`, name: draft.name.trim(), bank: draft.bank.trim(), balance: Number(draft.balance) || 0, color: previous?.color || 'green' }; saveList(editing ? accounts.map((account) => account.id === previous?.id ? entry : account) : [...accounts, entry]); setModal(false); notify(editing ? 'Conta atualizada no workspace.' : 'Conta cadastrada no workspace.'); };
  const remove = (account) => { if (!window.confirm(`Remover ${account.name}? As movimentações registradas nela também serão removidas.`)) return; saveList(accounts.filter((a) => a.id !== account.id)); saveTransactionList(transactions.filter((row) => row.accountId !== account.id)); notify('Conta removida do workspace.'); };
  const exportCsv = () => { const csv = [['Conta', 'Instituição', 'Saldo'], ...accounts.map((a) => [a.name, a.bank, a.balance])].map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(';')).join('\n'); const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'nexo-contas.csv'; link.click(); URL.revokeObjectURL(url); notify('CSV das contas exportado.'); };
  const visibleTransactions = transactions.filter((row) => selected === 'Todas' || row.accountName === selected);
  const total = accounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const actionRows = visibleTransactions.map((row) => [row.description, row.accountName, row.date ? new Date(row.date).toLocaleDateString('pt-BR') : '', money(Number(row.amount)), row.status || 'Registrada']);
  return <><div className="ns-metrics ns-metrics-three"><Metric label="Saldo total registrado" value={money(total)} note={`${accounts.length} contas`} icon={Wallet} /><Metric label="Contas conectadas" value="0" note="Nenhum provedor conectado" icon={Link2} /><Metric label="Movimentações" value={String(transactions.length).padStart(2, '0')} note="Registros do workspace" icon={Activity} /></div><div className="ns-section-heading"><div><h2>Suas contas</h2><p>Cadastre contas e acompanhe saldos e movimentações.</p></div><button className="ns-primary" type="button" onClick={openNew}><Plus size={15} />Adicionar conta</button></div><div className="ns-account-grid">{accounts.map((account) => <article className="ns-account-card" key={account.name}><div className="ns-account-head"><span className={`ns-bank-icon ${account.color}`}><Wallet size={19} /></span><div className="ns-account-actions"><IconButton label={`Editar ${account.name}`} onClick={() => openEdit(account)}><Pencil size={15} /></IconButton><IconButton label={`Remover ${account.name}`} onClick={() => remove(account)}><Trash2 size={15} /></IconButton></div></div><small>{account.name}</small><b>{money(Number(account.balance))}</b><span>{account.bank}</span><button type="button" onClick={() => setSelected(account.name)}>Ver movimentações <ChevronRight size={15} /></button></article>)}<button type="button" className="ns-add-account" onClick={openNew}><span><Plus size={18} /></span><b>Adicionar conta</b><small>Registre uma conta e saldo inicial</small></button></div><div className="ns-section-heading"><div><h2>Movimentações recentes</h2><p>{selected === 'Todas' ? 'Entradas e saídas das contas' : `Movimentações de ${selected}`} <button className="ns-link-button" onClick={() => setSelected('Todas')}>Ver todas</button></p></div><button className="ns-text-button" type="button" onClick={exportCsv}>Exportar <ExternalLink size={14} /></button></div><DataTable columns={['Lançamento', 'Conta', 'Data', 'Valor', 'Status']} rows={actionRows} search onAction={notify} />
    <div className="ns-info-note"><ShieldCheck size={17} /><span>O saldo é informado manualmente; esta tela não se conecta a bancos nem sincroniza transações.</span></div>
    {modal && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false); }}><form className="ns-integration-modal" onSubmit={save}><header><span className="ns-integration-logo mercado"><Wallet size={18} /></span><div><h2>{editing ? 'Editar conta' : 'Adicionar conta'}</h2><p>Informe os dados para o controle local.</p></div><button type="button" aria-label="Fechar" onClick={() => setModal(false)}><X size={17} /></button></header><div className="ns-integration-fields"><label>Nome da conta<input autoFocus required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Conta principal" /></label><label>Banco ou instituição<input required value={draft.bank} onChange={(e) => setDraft({ ...draft, bank: e.target.value })} placeholder="Ex.: Nubank" /></label><label>Saldo inicial<input type="number" step="0.01" value={draft.balance} onChange={(e) => setDraft({ ...draft, balance: e.target.value })} /></label></div><div className="ns-integration-modal-note"><ShieldCheck size={15} />Nenhuma conexão bancária é iniciada por este formulário.</div><footer><button className="ns-secondary" type="button" onClick={() => setModal(false)}>Cancelar</button><button className="ns-primary" type="submit"><Check size={14} />Salvar conta</button></footer></form></div>}</>;
}

function FinanceList({ page, notify }) {
  const titles = { receitas: ['Lançamento', 'Cliente / descrição', 'Data', 'Valor', 'Status'], despesas: ['Lançamento', 'Fornecedor / categoria', 'Data', 'Valor', 'Status'] };
  const resourceKey = page === 'despesas' ? 'nexo.finance.despesas.v1' : 'nexo.finance.receitas.v1';
  const [records, setRecords] = useStoredArray(resourceKey, []);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const verb = page === 'despesas' ? 'Nova despesa' : 'Nova receita';
  const amountNumber = (item) => Number(item.amount) || 0;
  const moneyRows = records.map((item) => [item.code || item.id, item.description || '', item.date ? new Date(item.date).toLocaleDateString('pt-BR') : '', money(amountNumber(item)), item.status || 'Pendente']);
  const submit = (event) => {
    event.preventDefault();
    const value = Number(amount.replace(',', '.'));
    if (!name.trim() || !value) { notify('Preencha a descrição e um valor válido.'); return; }
    const record = { id: globalThis.crypto?.randomUUID?.() || `${page}-${Date.now()}`, code: `${page.slice(0, 3).toUpperCase()}-${String(Date.now()).slice(-5)}`, description: name.trim(), counterparty: name.trim(), category: 'Lançamento manual', date: new Date().toISOString(), amount: value, status: 'Pendente' };
    setRecords((current) => [record, ...current]);
    setName(''); setAmount(''); setFormOpen(false);
    notify(`${verb} enviada para gravação no workspace.`);
  };
  const doAction = (message) => {
    const code = message.replace('Opções de ', '');
    const target = records.find((item) => (item.code || item.id) === code);
    if (!target) return notify(message);
    if (!window.confirm(`${target.status === 'Pendente' ? 'Marcar como pago/recebido' : 'Remover'} “${target.description}” (${money(amountNumber(target))})?`)) return;
    if (target.status === 'Pendente') setRecords((current) => current.map((item) => item.id === target.id ? { ...item, status: page === 'despesas' ? 'Paga' : 'Recebida', settledAt: new Date().toISOString() } : item));
    else setRecords((current) => current.filter((item) => item.id !== target.id));
    notify('Alteração enviada para o workspace.');
  };
  const total = records.reduce((sum, item) => sum + amountNumber(item), 0);
  const pending = records.filter((item) => item.status === 'Pendente');
  const delayed = records.filter((item) => item.status === 'Atrasada' || item.status === 'Vencida');
  return <><div className="ns-metrics ns-metrics-three"><Metric label={page === 'despesas' ? 'Despesas registradas' : 'Receitas registradas'} value={money(total)} note={`${records.length} lançamentos no workspace`} icon={page === 'despesas' ? ArrowUpRight : ArrowDownLeft} /><Metric label="Aguardando" value={money(pending.reduce((sum, item) => sum + amountNumber(item), 0))} note={`${pending.length} lançamentos pendentes`} icon={Clock3} /><Metric label="Em atraso" value={money(delayed.reduce((sum, item) => sum + amountNumber(item), 0))} note={`${delayed.length} precisam de atenção`} icon={AlertCircle} /></div>{formOpen && <form className="ns-inline-form" onSubmit={submit}><div><b>{verb}</b><small>O registro será guardado na conta do workspace.</small></div><input aria-label="Descrição ou cliente" required placeholder="Descrição ou cliente" value={name} onChange={(event) => setName(event.target.value)} /><input aria-label="Valor" required type="number" min="0.01" step="0.01" placeholder="Valor (ex.: 850,00)" value={amount} onChange={(event) => setAmount(event.target.value)} /><button className="ns-primary" type="submit"><Check size={15} />Salvar</button><IconButton label="Fechar formulário" onClick={() => setFormOpen(false)}><X size={16} /></IconButton></form>}<DataTable columns={titles[page]} rows={moneyRows} search onAction={doAction} /><div className="ns-page-bottom"><span><ShieldCheck size={15} /> Lançamentos vinculados ao workspace</span><button className="ns-secondary" type="button" onClick={() => setFormOpen((open) => !open)}><Plus size={15} />{verb}</button></div></>;
}
function Inbox({ notify, forceWhatsapp = false }) {
  const [messages, setMessages, refreshMessages] = useStoredArray('nexo.support.conversations.v1', initialMessages);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('Todas');
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState('WhatsApp');
  const [newOpen, setNewOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', company: '', phone: '', email: '' });
  const [attachment, setAttachment] = useState('');
  const [owner, setOwner] = useState('');
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [sending, setSending] = useState(false);
  const current = messages.find((item) => String(item.id) === String(selectedId)) || messages[0];
  const activeSessions = sessions.filter((session) => session.status === 'WORKING');
  const effectiveSessionId = selectedSessionId || current?.whatsappSessionId || activeSessions[0]?.id || '';
  useEffect(() => {
    const linked = activeSessions.find((session) => session.id === current?.whatsappSessionId);
    if (linked) setSelectedSessionId(linked.id);
    else if (!activeSessions.some((session) => session.id === selectedSessionId)) setSelectedSessionId(activeSessions[0]?.id || '');
  }, [current?.id, current?.whatsappSessionId, activeSessions.map((session) => session.id).join('|')]);
  const selectConversation = (item) => {
    setSelectedId(String(item.id));
    setMessages((items) => items.map((row) => String(row.id) === String(item.id) ? { ...row, unread: 0 } : row));
  };
  useEffect(() => {
    let mounted = true;
    const loadSessions = async () => {
      try {
        const result = await apiRequest('/api/integrations/waha/sessions');
        if (!mounted) return;
        const rows = result.data || [];
        setSessions(rows);
        setSelectedSessionId((currentId) => rows.some((row) => row.id === currentId && row.status === 'WORKING') ? currentId : rows.find((row) => row.status === 'WORKING')?.id || '');
      } catch { if (mounted) setSessions([]); }
    };
    loadSessions();
    const sessionsTimer = window.setInterval(loadSessions, 15000);
    const messagesTimer = window.setInterval(() => refreshMessages().catch(() => {}), 5000);
    return () => { mounted = false; window.clearInterval(sessionsTimer); window.clearInterval(messagesTimer); };
  }, [refreshMessages]);
  useEffect(() => {
    if (!selectedId && messages[0]?.id) setSelectedId(String(messages[0].id));
  }, [messages, selectedId]);
  const send = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (attachment) { notify('O envio de anexos ainda não está habilitado; remova o arquivo e envie o texto.'); return; }
    if (!text || !current || sending) return;
    const sessionId = selectedSessionId || current.whatsappSessionId || activeSessions[0]?.id;
    const digits = String(current.phone || '').replace(/\D/g, '');
    const normalizedPhone = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
    const chatId = current.whatsappChatId || (normalizedPhone ? `${normalizedPhone}@c.us` : '');
    if (channel !== 'WhatsApp') { notify('Envio por e-mail ainda não está conectado nesta caixa de entrada.'); return; }
    if (!sessionId || !chatId) { notify(!sessionId ? 'Conecte uma sessão WAHA ativa em Integrações.' : 'Esta conversa não tem telefone válido para WhatsApp.'); return; }
    setSending(true);
    try {
      await apiRequest('/api/integrations/waha/send', { method: 'POST', body: JSON.stringify({ sessionId, conversationId: current.id, clientMessageId: globalThis.crypto.randomUUID(), chatId, text }) });
      setDraft(''); setAttachment('');
      await refreshMessages();
      notify('Mensagem enviada pelo WhatsApp.');
    } catch (error) { notify(error.message || 'Não foi possível enviar a mensagem pelo WhatsApp.'); }
    finally { setSending(false); }
  };
  const createConversation = async (event) => {
    event.preventDefault();
    if (!newContact.name.trim() || !newContact.company.trim()) return;
    const digits = String(newContact.phone || '').replace(/\D/g, '');
    const phoneDigits = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
    const item = { id: globalThis.crypto?.randomUUID?.() || `conversation-${Date.now()}`, ...newContact, initials: newContact.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), time: new Date().toISOString(), text: '', unread: 0, color: 'blue', channel: 'WhatsApp', owner, whatsappSessionId: selectedSessionId || activeSessions[0]?.id || '', whatsappChatId: phoneDigits ? `${phoneDigits}@c.us` : '', history: [] };
    try { const saved = await apiRequest('/api/workspace/inbox', { method: 'POST', body: JSON.stringify({ data: Object.fromEntries(Object.entries(item).filter(([field]) => !['id', 'createdAt', 'updatedAt'].includes(field))) }) }); await refreshMessages(); setSelectedId(String(saved.data.id)); setNewOpen(false); setNewContact({ name: '', company: '', phone: '', email: '' }); notify('Conversa criada. Selecione uma sessão WAHA ativa para enviar mensagens.'); } catch (error) { notify(error.message || 'Não foi possível criar a conversa.'); }
  };
  const shown = messages.filter((item) => `${item.name} ${item.company} ${item.text}`.toLowerCase().includes(query.toLowerCase())).filter((item) => filter === 'Todas' || (filter === 'Nao lidas' ? item.unread > 0 : item.unread === 0));
  const history = current?.history?.length ? current.history : (current?.text ? [{ side: 'received', text: current.text, time: current.time || '' }] : []);
  const createTask = async () => { if (!current) return; try { await apiRequest('/api/workspace/tasks', { method: 'POST', body: JSON.stringify({ data: { title: `Retornar para ${current.name}`, project: 'Atendimento', client: current.company, due: '', assignee: owner, status: 'A fazer', priority: 'Normal' } }) }); notify('Tarefa salva no workspace.'); } catch (error) { notify(error.message || 'Não foi possível criar a tarefa.'); } };
  return <div className="ns-inbox-layout"><aside className="ns-inbox-list"><div className="ns-inbox-top"><div className="ns-channel-switch"><button type="button" className={channel === 'WhatsApp' ? 'active' : ''} onClick={() => setChannel('WhatsApp')}><MessageCircle size={15} />WhatsApp <span>{messages.length}</span></button><button type="button" className={channel === 'E-mail' ? 'active' : ''} onClick={() => setChannel('E-mail')}><Mail size={15} /></button></div><IconButton label="Nova conversa" onClick={() => setNewOpen(true)}><Plus size={17} /></IconButton></div><label className="ns-search ns-inbox-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conversa" /></label><div className="ns-filter-tabs compact">{['Todas', 'Nao lidas'].map((item) => <button type="button" key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="ns-conversation-list">{shown.map((item) => <button type="button" onClick={() => selectConversation(item)} className={`ns-conversation ${String(current?.id) === String(item.id) ? 'active' : ''}`} key={item.id}><span className={`ns-avatar ${item.color || 'blue'}`}>{item.initials || item.name?.slice(0, 1)}</span><span className="ns-conversation-copy"><span><b>{item.name}</b><small>{item.time}</small></span><small>{item.company}</small><span className="ns-preview">{item.text}</span></span>{item.unread > 0 && <i className="ns-unread">{item.unread}</i>}</button>)}</div>{shown.length === 0 && <p className="ns-empty-history">Nenhuma conversa encontrada.</p>}</aside><section className="ns-chat"><header className="ns-chat-header"><div className="ns-chat-person"><span className={`ns-avatar ${current?.color || 'blue'}`}>{current?.initials || current?.name?.slice(0, 1)}</span><span><b>{current?.name || 'Selecione uma conversa'}</b><small>{current?.company || ''} · WhatsApp</small></span></div><div className="ns-chat-actions"><IconButton label="Ligar" onClick={() => notify('Inicie a chamada pelo WhatsApp conectado.')}><Smartphone size={16} /></IconButton><IconButton label="Mais opções" onClick={() => notify(`Conversa com ${current?.name || 'cliente'} · ${current?.phone || 'telefone não informado'}`)}><MoreHorizontal size={18} /></IconButton></div></header><div className="ns-chat-context"><span className={`ns-online-dot ${effectiveSessionId ? '' : 'offline'}`} />{activeSessions.length ? <><span>Sessão WhatsApp</span><select aria-label="Sessão WhatsApp" value={effectiveSessionId} onChange={(event) => setSelectedSessionId(event.target.value)}>{activeSessions.map((session) => <option key={session.id} value={session.id}>{session.label || session.name || session.sessionName || session.id}</option>)}</select></> : <span>Sem sessão WAHA conectada</span>}<button type="button" onClick={() => window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Integrações' }))}>Configurar <ExternalLink size={12} /></button></div><div className="ns-chat-history"><div className="ns-date-divider"><span>Histórico WhatsApp</span></div>{history.map((message, index) => <div className={`ns-message ${message.side}`} key={`${message.clientMessageId || message.providerMessageId || message.time}-${index}`}>{message.text}{message.attachment && <small><Paperclip size={11}/>{message.attachment}</small>}<small>{message.time}{message.side === 'sent' && <Check size={12} />}</small></div>)}</div><form className="ns-compose" onSubmit={send}><label className="ns-attach-control" title="Anexar arquivo"><Plus size={18}/><input type="file" onChange={(event) => setAttachment(event.target.files?.[0]?.name || '')}/></label><input aria-label="Escrever mensagem" placeholder={channel === 'WhatsApp' ? 'Escreva uma mensagem via WhatsApp...' : 'E-mail indisponível nesta caixa'} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!current || sending} /><button className="ns-send" aria-label="Enviar mensagem" type="submit" disabled={!current || sending || !draft.trim()}><Send size={16} /></button></form><footer className="ns-chat-foot">{effectiveSessionId ? 'Mensagens sincronizadas com WAHA' : 'Conecte uma sessão WAHA para enviar'}<span>{sending ? 'Enviando?' : 'Entrada atualizada automaticamente'}</span></footer></section><aside className="ns-contact-panel"><div className="ns-contact-profile"><span className={`ns-avatar large ${current?.color || 'blue'}`}>{current?.initials || current?.name?.slice(0, 1)}</span><b>{current?.name || 'Sem conversa selecionada'}</b><small>{current?.company}</small><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Clientes' }))}>Ver cadastro <ChevronRight size={14} /></button></div><div className="ns-contact-block"><span>Contato</span><b>{current?.phone || 'Telefone não informado'}</b><small>{current?.email || 'E-mail não informado'}</small></div><div className="ns-contact-block"><span>Responsável</span><select aria-label="Responsável pelo atendimento" value={owner} onChange={(event) => setOwner(event.target.value)}><option value="">Sem responsável</option></select></div><button type="button" className="ns-link-task" onClick={createTask} disabled={!current}><Plus size={15} />Criar tarefa de retorno</button></aside>
    {newOpen && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNewOpen(false); }}><form className="ns-integration-modal" onSubmit={createConversation}><header><span className="ns-integration-logo"><MessageCircle size={18}/></span><div><h2>Nova conversa</h2><p>Crie um atendimento WhatsApp vinculado a um contato.</p></div><button type="button" aria-label="Fechar" onClick={() => setNewOpen(false)}><X size={17}/></button></header><div className="ns-integration-fields"><label>Nome<input autoFocus required value={newContact.name} onChange={(event) => setNewContact({ ...newContact, name: event.target.value })}/></label><label>Empresa / cliente<input required value={newContact.company} onChange={(event) => setNewContact({ ...newContact, company: event.target.value })}/></label><label>Telefone<input required value={newContact.phone} onChange={(event) => setNewContact({ ...newContact, phone: event.target.value })}/></label><label>E-mail<input type="email" value={newContact.email} onChange={(event) => setNewContact({ ...newContact, email: event.target.value })}/></label>{activeSessions.length > 0 && <label>Sessão WAHA<select value={selectedSessionId || activeSessions[0].id} onChange={(event) => setSelectedSessionId(event.target.value)}>{activeSessions.map((session) => <option key={session.id} value={session.id}>{session.label || session.name || session.sessionName || session.id}</option>)}</select></label>}</div><div className="ns-integration-modal-note"><ShieldCheck size={15}/>A mensagem só será enviada ao clicar em Enviar.</div><footer><button className="ns-secondary" type="button" onClick={() => setNewOpen(false)}>Cancelar</button><button className="ns-primary" type="submit"><Check size={14}/>Criar conversa</button></footer></form></div>}</div>;
}

function Tickets({ notify }) {
  const { records: rows, loading, error, refresh, create, update } = useWorkspaceRecords('tickets');
  const [form, setForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState({ title: '', client: '', priority: 'Media', owner: '', detail: '' });
  const [edit, setEdit] = useState({ status: '', owner: '', priority: '', detail: '' });
  const addTicket = async (event) => { event.preventDefault(); if (!draft.title.trim() || !draft.client.trim()) { notify('Informe a solicitacao e o cliente.'); return; } try { await create({ code: `NX-${globalThis.crypto.randomUUID().slice(0, 8).toUpperCase()}`, title: draft.title.trim(), client: draft.client.trim(), priority: draft.priority, status: 'Aberto', updatedAt: new Date().toISOString(), detail: draft.detail.trim(), owner: draft.owner.trim() }); setDraft({ title: '', client: '', priority: 'Media', owner: '', detail: '' }); setForm(false); notify('Ticket salvo no banco de dados.'); } catch (saveError) { notify(saveError.message || 'Nao foi possivel salvar o ticket.'); } };
  const openTicket = (label) => { const row = rows.find((item) => label.includes(item.code)); if (!row) return notify(label); setSelected(row); setEdit({ status: row.status, owner: row.owner || '', priority: row.priority, detail: row.detail || '' }); };
  const saveTicket = async (event) => { event.preventDefault(); try { await update(selected.id, { priority: edit.priority, status: edit.status, updatedAt: new Date().toISOString(), detail: edit.detail, owner: edit.owner }); setSelected(null); notify('Ticket atualizado no banco de dados.'); } catch (saveError) { notify(saveError.message || 'Nao foi possivel atualizar o ticket.'); } };
  const cards = [['Abertos', rows.filter((row) => row.status === 'Aberto').length, 'blue'], ['Em andamento', rows.filter((row) => row.status === 'Em andamento').length, 'purple'], ['Aguardando cliente', rows.filter((row) => row.status === 'Aguardando cliente').length, 'orange'], ['Resolvidos', rows.filter((row) => row.status === 'Resolvido').length, 'green']];
  const ticketRows = rows.map((row) => [row.code, row.title, row.client, row.priority, row.status, row.updatedAt ? new Date(row.updatedAt).toLocaleString('pt-BR') : '']);
  return <>{loading && <div className="ns-empty-history">Carregando tickets...</div>}{error && <div className="dashboard-data-error" role="alert">{error}<button type="button" onClick={refresh}>Tentar novamente</button></div>}<div className="ns-ticket-stats">{cards.map(([label, value, color]) => <article key={label}><span className={`ns-stat-mark ${color}`} /><span>{label}</span><b>{value}</b></article>)}</div>{form && <form className="ns-inline-form ns-ticket-compose" onSubmit={addTicket}><div><b>Novo ticket</b><small>Registre a solicitaÃ§Ã£o e atribua um responsÃ¡vel</small></div><input aria-label="Resumo do ticket" required placeholder="O que precisa ser resolvido?" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /><input aria-label="Cliente" required placeholder="Cliente" value={draft.client} onChange={(event) => setDraft({ ...draft, client: event.target.value })} /><select aria-label="Prioridade" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}><option>Baixa</option><option>Media</option><option>Alta</option><option>Urgente</option></select><input aria-label="ResponsÃ¡vel" placeholder="ResponsÃ¡vel" value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} /><button className="ns-primary" type="submit"><Check size={15} />Criar ticket</button><IconButton label="Fechar formulario" onClick={() => setForm(false)}><X size={16} /></IconButton></form>}<div className="ns-section-heading"><div><h2>Fila de atendimento</h2><p>Abra um ticket para atualizar prioridade, responsÃ¡vel, status e detalhes.</p></div><button className="ns-secondary" type="button" onClick={() => setForm((value) => !value)}><Plus size={15} />Novo ticket</button></div><DataTable columns={['Ticket', 'SolicitaÃ§Ã£o', 'Cliente', 'Prioridade', 'Status', 'Atualizado']} rows={ticketRows} search onAction={openTicket} statusIndex={4} />
    {selected && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><form className="ns-integration-modal" onSubmit={saveTicket}><header><span className="ns-integration-logo"><LifeBuoy size={18}/></span><div><h2>{selected.code} · {selected.title}</h2><p>{selected.client} · atualizado {selected.updatedAt ? new Date(selected.updatedAt).toLocaleString('pt-BR') : ''}</p></div><button type="button" aria-label="Fechar" onClick={() => setSelected(null)}><X size={17}/></button></header><div className="ns-integration-fields"><label>Status<select value={edit.status} onChange={(event) => setEdit({ ...edit, status: event.target.value })}>{['Aberto','Em andamento','Aguardando cliente','Resolvido'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Prioridade<select value={edit.priority} onChange={(event) => setEdit({ ...edit, priority: event.target.value })}>{['Baixa','Media','Alta','Urgente'].map((value) => <option key={value}>{value}</option>)}</select></label><label>ResponsÃ¡vel<input value={edit.owner} onChange={(event) => setEdit({ ...edit, owner: event.target.value })}/></label><label>Cliente<input readOnly value={selected.client}/></label><label className="wide">DescriÃ§Ã£o<textarea rows="4" value={edit.detail} onChange={(event) => setEdit({ ...edit, detail: event.target.value })} placeholder="Contexto, passos para reproduzir e soluÃ§Ã£o"/></label></div><footer><button className="ns-secondary" type="button" onClick={() => setSelected(null)}>Cancelar</button><button className="ns-primary" type="submit"><Check size={14}/>Salvar ticket</button></footer></form></div>}
  </>;
}

function Sites({ page, notify }) {
  const assetsStore = useWorkspaceRecords('site-assets');
  const clientsStore = useWorkspaceRecords('clients');
  const monitorsStore = useWorkspaceRecords('monitors');
  const assetsState = assetsStore.records;
  const [checkingId, setCheckingId] = useState('');
  const checkSite = async (asset) => {
    setCheckingId(String(asset.id));
    try {
      const result = await apiRequest('/api/monitoring/site-assets/' + encodeURIComponent(asset.id) + '/check', { method: 'POST', body: '{}' });
      assetsStore.setRecords((current) => current.map((item) => String(item.id) === String(result.data.id) ? result.data : item));
      notify(result.data.health === 'Online' ? 'Site respondeu. Status e certificado foram atualizados.' : 'Site n?o respondeu; confira endere?o e hospedagem.');
    } catch (error) { notify(error.message || 'N?o foi poss?vel verificar o site.'); }
    finally { setCheckingId(''); }
  };
  const monitorsState = monitorsStore.records;
  const [assetModal, setAssetModal] = useState(false);
  const [assetDraft, setAssetDraft] = useState({ name: '', clientId: '', type: 'Domínio + hospedagem', renewalDate: '' });
  const visible = page === 'dominios' ? assetsState.filter((asset) => asset.type.toLowerCase().startsWith('dom')) : page === 'hospedagens' ? assetsState.filter((asset) => asset.type.toLowerCase().includes('hospedagem')) : assetsState;
  const addAsset = async (event) => {
    event.preventDefault();
    const client = clientsStore.records.find((item) => String(item.id) === String(assetDraft.clientId));
    if (!assetDraft.name.trim() || !client) { notify('Selecione um cliente cadastrado e informe o ativo.'); return; }
    try {
      await assetsStore.create({ name: assetDraft.name.trim(), clientId: client.id, client: client.name, type: assetDraft.type, renewalDate: assetDraft.renewalDate || '', health: 'Não verificado' });
      setAssetModal(false);
      setAssetDraft({ name: '', clientId: '', type: 'Domínio + hospedagem', renewalDate: '' });
      notify('Ativo salvo no workspace e vinculado ao cliente.');
    } catch (error) { notify(error.message || 'Não foi possível salvar o ativo.'); }
  };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const renewalDateFor = (asset) => {
    const raw = String(asset.renewalDate || asset.renewal || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T00:00:00`);
    const legacy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (legacy) return new Date(Number(legacy[3]), Number(legacy[2]) - 1, Number(legacy[1]));
    return null;
  };
  const daysUntilRenewal = (asset) => { const date = renewalDateFor(asset); return date && !Number.isNaN(date.getTime()) ? Math.ceil((date - today) / 86_400_000) : null; };
  const renewalsSoon = visible.filter((asset) => { const days = daysUntilRenewal(asset); return days !== null && days >= 0 && days <= 30; }).length;
  const missingRenewal = visible.filter((asset) => daysUntilRenewal(asset) === null).length;
  const [expanded, setExpanded] = useState('');
  if (page === 'monitoramento') {
    const checked = assetsState.filter((item) => item.checkedAt);
    const online = checked.filter((item) => item.health === 'Online').length;
    return <><div className="ns-metrics ns-metrics-three"><Metric label="Ativos monitoraveis" value={String(assetsState.length)} note="dominios e sites cadastrados" icon={Activity} /><Metric label="Online na ultima consulta" value={checked.length ? online + '/' + checked.length : '?'} note="verificacoes manuais registradas" icon={TrendingUp} /><Metric label="Offline na ultima consulta" value={String(checked.filter((item) => item.health === 'Offline').length)} note="rever endereco ou hospedagem" icon={AlertCircle} /></div>{assetsStore.loading && <p className="ns-empty-history">Carregando ativos...</p>}{assetsStore.error && <div className="dashboard-data-error" role="alert">{assetsStore.error}<button type="button" onClick={assetsStore.refresh}>Tentar novamente</button></div>}<div className="ns-monitor-list">{assetsState.map((item) => <article className="ns-monitor-row" key={item.id}><span className={'ns-monitor-pulse' + (item.health === 'Offline' ? ' warn' : '')}><i /></span><span className="ns-monitor-main"><b>{item.name}</b><small>{item.url || item.domain || item.name}</small></span><span className={'ns-monitor-status' + (item.health === 'Offline' ? ' warn' : '')}>{item.health || 'Nao verificado'}</span><span className="ns-monitor-data"><small>Ultima verificacao</small><b>{item.checkedAt ? new Date(item.checkedAt).toLocaleString('pt-BR') : '?'}</b></span><span className="ns-monitor-data"><small>SSL expira</small><b>{item.sslExpiresAt ? new Date(item.sslExpiresAt).toLocaleDateString('pt-BR') : '?'}</b></span><button className="ns-check-button" type="button" onClick={() => checkSite(item)} disabled={checkingId === String(item.id)}>{checkingId === String(item.id) ? 'Verificando...' : item.checkedAt ? 'Verificar' : 'Verificar agora'}</button></article>)}{assetsState.length === 0 && !assetsStore.loading && <div className="ns-empty-history">Cadastre um site ou dominio para verificar sua disponibilidade.</div>}</div><div className="ns-info-note"><ShieldCheck size={17} /><span>A consulta manual confirma resposta HTTP e validade SSL naquele momento. Nao e monitoramento continuo nem calcula uptime historico.</span></div></>;
  }
  return <>{assetsStore.loading && <p className="ns-empty-history">Carregando ativos…</p>}{assetsStore.error && <div className="dashboard-data-error" role="alert">{assetsStore.error}<button type="button" onClick={assetsStore.refresh}>Tentar novamente</button></div>}<div className="ns-metrics ns-metrics-three"><Metric label="Ativos cadastrados" value={String(visible.length)} note="Sites, domínios e hospedagens" icon={Globe2} /><Metric label="Renovam em até 30 dias" value={String(renewalsSoon)} note="Com data de renovação cadastrada" icon={CalendarClock} /><Metric label="Sem data de renovação" value={String(missingRenewal)} note="Ativos que precisam de uma data" icon={AlertCircle} /></div><div className="ns-assets-list">{visible.map((asset) => { const Icon = (asset.type || '').toLowerCase().includes('hospedagem') ? HardDrive : Globe2; const renewalDateValue = renewalDateFor(asset); const renewalDate = renewalDateValue ? renewalDateValue.toLocaleDateString('pt-BR') : 'Não informada'; return <article className="ns-asset-row" key={asset.id}><span className="ns-asset-icon"><Icon size={19} /></span><span className="ns-asset-main"><b>{asset.name}</b><small>{asset.client || clientsStore.records.find((client) => String(client.id) === String(asset.clientId))?.name || 'Cliente não vinculado'}</small></span><span className="ns-asset-type">{asset.type || 'Tipo não informado'}</span><span className="ns-asset-renew"><small>Renovação</small><b>{renewalDate}</b></span><Status>{asset.health || 'Não verificado'}</Status><IconButton label={`Detalhes de ${asset.name}`} onClick={() => setExpanded(expanded === asset.id ? '' : asset.id)}><ChevronDown size={16} /></IconButton>{expanded === asset.id && <div className="ns-asset-detail"><span>Cliente vinculado <b>{asset.clientId ? 'Sim' : 'Não vinculado'}</b></span><span>DNS <b>{asset.dnsProvider || 'Não informado'}</b></span><span>Renovação automática <b>{asset.autoRenew === true ? 'Ativa' : asset.autoRenew === false ? 'Inativa' : 'Não informado'}</b></span><button type="button" onClick={async () => { if (!window.confirm(`Remover ${asset.name} do cadastro?`)) return; try { await assetsStore.remove(asset.id); if (expanded === asset.id) setExpanded(''); notify('Ativo removido do workspace.'); } catch (error) { notify(error.message || 'Não foi possível remover o ativo.'); } }}>Remover <Trash2 size={13} /></button></div>}</article>; })}{visible.length === 0 && !assetsStore.loading && <div className="ns-empty-history">Nenhum ativo cadastrado.</div>}</div><div className="ns-page-bottom"><span><Cloud size={15} /> Ativos salvos no workspace</span><button className="ns-secondary" type="button" onClick={() => setAssetModal(true)}><Plus size={15} />Adicionar ativo</button></div><div className="ns-info-note"><ShieldCheck size={17} /><span>Status de uptime e SSL não verificado. O cadastro não executa monitoramento automático.</span></div>{assetModal && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setAssetModal(false); }}><form className="ns-integration-modal" onSubmit={addAsset}><header><span className="ns-integration-logo google"><Globe2 size={18} /></span><div><h2>Adicionar ativo</h2><p>Registre um site, domínio ou hospedagem vinculado a um cliente.</p></div><button type="button" aria-label="Fechar" onClick={() => setAssetModal(false)}><X size={17} /></button></header><div className="ns-integration-fields"><label>Domínio ou nome<input required autoFocus value={assetDraft.name} onChange={(e) => setAssetDraft({ ...assetDraft, name: e.target.value })} placeholder="exemplo.com.br" /></label><label>Cliente cadastrado<select required value={assetDraft.clientId} onChange={(e) => setAssetDraft({ ...assetDraft, clientId: e.target.value })}><option value="">Selecione um cliente</option>{clientsStore.records.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Tipo<select value={assetDraft.type} onChange={(e) => setAssetDraft({ ...assetDraft, type: e.target.value })}><option>Domínio + hospedagem</option><option>Domínio</option><option>Hospedagem</option><option>Site</option></select></label><label>Próxima renovação<input type="date" value={assetDraft.renewalDate} onChange={(e) => setAssetDraft({ ...assetDraft, renewalDate: e.target.value })} /></label></div>{clientsStore.error && <div className="ns-info-note" role="alert">{clientsStore.error}<button type="button" onClick={clientsStore.refresh}>Tentar novamente</button></div>}{clientsStore.records.length === 0 && !clientsStore.loading && <div className="ns-info-note">Cadastre um cliente antes de adicionar um ativo.</div>}<div className="ns-integration-modal-note"><ShieldCheck size={15} />O registro será salvo no banco de dados. O monitoramento precisa ser habilitado separadamente.</div><footer><button className="ns-secondary" type="button" onClick={() => setAssetModal(false)}>Cancelar</button><button className="ns-primary" type="submit" disabled={clientsStore.loading || clientsStore.records.length === 0}><Check size={14} />Salvar ativo</button></footer></form></div>}</>;
}

function Integrations({ notify }) {
  const [integrationStatus, setIntegrationStatus] = useState({});
  const [statusLoading, setStatusLoading] = useState(true);
  const [filter, setFilter] = useState('Todas');
  const [configuring, setConfiguring] = useState(null);
  const [testing, setTesting] = useState(false);
  const [changingConnection, setChangingConnection] = useState('');
  const [testResult, setTestResult] = useState(null);
  const refreshStatus = async (verifyConnections = true) => {
    setStatusLoading(true);
    try {
      const { data } = await apiRequest('/api/integrations/status');
      let latest = data;
      if (verifyConnections) {
        const candidates = data.filter((item) => item.configured && item.enabled);
        await Promise.all(candidates.map((item) => apiRequest(`/api/integrations/${item.provider}/test`, { method: 'POST', body: '{}' }).catch(() => null)));
        if (candidates.length) latest = (await apiRequest('/api/integrations/status')).data;
      }
      setIntegrationStatus(Object.fromEntries(latest.map((item) => [item.name, item])));
    } catch (error) { notify(error.message || 'Nao foi possivel consultar o status das integracoes.'); }
    finally { setStatusLoading(false); }
  };
  useEffect(() => { refreshStatus(); }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get('google');
    if (!result) return;
    url.searchParams.delete('google');
    const reason = url.searchParams.get('reason');
    url.searchParams.delete('reason');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    if (result === 'connected') notify('Conta Google autorizada com sucesso.');
    else notify(`Não foi possível conectar o Google (${reason || 'erro de autorização'}). Confira o OAuth e tente novamente.`);
    refreshStatus(false);
  }, []);
  const categories = ['Todas', 'Pagamentos', 'WhatsApp', 'E-mail', 'Produtividade', 'Documentos', 'Desenvolvimento', 'Automacoes', 'Monitoramento'];
  const setup = {
    'Mercado Pago': { provider: 'mercadopago', vars: ['MERCADOPAGO_ACCESS_TOKEN', 'MERCADOPAGO_WEBHOOK_SECRET'], note: 'O access token fica somente no serviço API. O teste consulta os meios de pagamento sem criar uma cobrança.' },
    'Evolution API': { provider: 'evolution', vars: ['EVOLUTION_API_URL', 'EVOLUTION_API_KEY'], note: 'Informe a URL base da Evolution API e a chave global. O teste lista as instâncias sem exibir a chave.' },
    WAHA: { provider: 'waha', vars: ['WAHA_API_URL', 'WAHA_API_KEY'], note: 'No Coolify, WAHA_API_URL pode apontar para http://waha:3000 quando o serviço está no mesmo Compose.' },
    Resend: { provider: 'resend', vars: ['RESEND_API_KEY'], note: 'O teste consulta os domínios da conta. Ele não envia e-mails.' },
    'Google Workspace': { provider: 'google', vars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'], note: 'Conecte sua conta Google para habilitar Gmail, Calendar, Drive e reuniões Meet. Cadastre no Google Cloud a URI de retorno exibida no servidor.' },
    Clicksign: { provider: 'clicksign', vars: ['CLICKSIGN_API_TOKEN', 'CLICKSIGN_API_BASE_URL'], note: 'Use o token da API Clicksign. Comece pelo sandbox; o teste apenas lista envelopes e não cria nem envia contratos.' },
    GitHub: { provider: 'github', vars: ['GITHUB_TOKEN'], note: 'O teste consulta a identidade do token. Use um token com o menor conjunto de permissões necessário.' },
    n8n: { provider: 'n8n', vars: ['N8N_BASE_URL', 'N8N_API_KEY'], note: 'Gere uma API key em Configurações > n8n API no n8n e salve em N8N_API_KEY no Coolify. O teste consulta a API autenticada de workflows, sem criar, ativar ou executar nenhum fluxo.' },
    Sentry: { provider: 'sentry', vars: ['SENTRY_DSN', 'VITE_SENTRY_DSN'], note: 'Configure o DSN no servidor (API) e no build web. Captura erros sem dados pessoais; o teste não cria um incidente artificial.' },
  };
  const testConnection = async () => {
    if (!configuring) return;
    if (integrationStatus[configuring.name]?.enabled === false) { setTestResult({ status: 'disconnected', message: 'Reative esta integração no Nexo antes de testar a conexão.' }); return; }
    setTesting(true); setTestResult(null);
    try {
      const result = await apiRequest(`/api/integrations/${setup[configuring.name].provider}/test`, { method: 'POST', body: '{}' });
      setTestResult({ status: result.data.status, message: result.data.message });
      if (result.data.status === 'connected') await refreshStatus(false);
    } catch (error) { setTestResult({ status: 'error', message: error.message || 'Falha ao testar a conexão.' }); }
    finally { setTesting(false); }
  };
  const authorizeGoogle = () => { window.location.assign('/api/integrations/google/authorize'); };
  const disconnectGoogle = async () => {
    if (!window.confirm('Desconectar a conta Google? O Nexo revogará o acesso e removerá os tokens salvos.')) return;
    setTesting(true); setTestResult(null);
    try {
      await apiRequest('/api/integrations/google/disconnect', { method: 'POST', body: '{}' });
      await refreshStatus(false);
      setTestResult({ status: 'connected', message: 'Conta Google desconectada e autorização revogada.' });
      notify('Conta Google desconectada.');
    } catch (error) { setTestResult({ status: 'error', message: error.message || 'Não foi possível desconectar a conta Google.' }); }
    finally { setTesting(false); }
  };
  const changeConnection = async (item, enabled) => {
    if (!enabled) {
      const details = item.name === 'WAHA'
        ? 'Isso pausa as sessões WhatsApp ativas. A chave continuará guardada no Coolify.'
        : 'O Nexo deixará de usar esta integração. As credenciais continuarão guardadas no Coolify.';
      if (!window.confirm(`Desconectar ${item.name}? ${details}`)) return;
    }
    setChangingConnection(item.name);
    try {
      await apiRequest(`/api/integrations/${setup[item.name].provider}/connection`, { method: 'POST', body: JSON.stringify({ enabled }) });
      await refreshStatus();
      notify(enabled ? `${item.name} reativada no Nexo. Teste a conexão para confirmar.` : `${item.name} desconectada do Nexo.`);
    } catch (error) { notify(error.message || `Não foi possível ${enabled ? 'reativar' : 'desconectar'} ${item.name}.`); }
    finally { setChangingConnection(''); }
  };
  const connectionLabel = (item) => {
    const state = integrationStatus[item.name];
    if (!state) return statusLoading ? 'Consultando status…' : 'Status indisponível';
    if (!state.configured) return 'Não configurada';
    if (!state.enabled) return 'Desconectada no Nexo';
    if (item.name === 'Google Workspace' && state.accountEmail) return `Conectada: ${state.accountEmail}`;
    if (item.name === 'Google Workspace') return 'Autorização necessária';
    if (state.lastTestStatus === 'connected') return 'Conectada no último teste';
    if (state.lastTestStatus === 'setup_required') return 'Configuração incompleta';
    if (state.lastTestStatus === 'error') return 'Falha no último teste';
    return 'Credenciais configuradas · testar';
  };
  const connectionTone = (item) => {
    const state = integrationStatus[item.name];
    return state?.enabled && state.lastTestStatus === 'connected' ? 'connected' : !state?.configured || state?.enabled === false ? 'disconnected' : 'pending';
  };
  const providerCategory = (name) => name === 'Mercado Pago' ? 'Pagamentos' : ['Evolution API', 'WAHA'].includes(name) ? 'WhatsApp' : name === 'Resend' ? 'E-mail' : name === 'Google Workspace' ? 'Produtividade' : name === 'Clicksign' ? 'Documentos' : name === 'GitHub' ? 'Desenvolvimento' : name === 'n8n' ? 'Automacoes' : 'Monitoramento';
  const visible = integrations.filter((item) => filter === 'Todas' || providerCategory(item.name) === filter);
  const connectedCount = Object.values(integrationStatus).filter((item) => item?.configured && item?.enabled && item?.lastTestStatus === 'connected').length;
  const configuredCount = Object.values(integrationStatus).filter((item) => item?.configured).length;
  const failedCount = Object.values(integrationStatus).filter((item) => item?.enabled && item?.lastTestStatus === 'error').length;
  return <>
    <section className="integration-overview" aria-label="Resumo das integrações"><div className="integration-overview-copy"><span className="integration-overview-icon"><Link2 size={19}/></span><div><span className="integration-eyebrow">CONEXÕES DO WORKSPACE</span><h2>Status da plataforma</h2><p>Conecte serviços e confira o estado reportado pela VPS. Segredos permanecem no servidor.</p></div><button className="ns-integration-refresh" type="button" onClick={() => refreshStatus()} disabled={statusLoading}><RefreshCw size={15} className={statusLoading ? 'ns-spinning' : ''}/>Atualizar status</button></div><div className="integration-overview-stats"><article><span>Conectadas</span><b>{statusLoading ? '—' : connectedCount}</b><small>confirmadas em teste</small></article><article><span>Configuradas</span><b>{statusLoading ? '—' : configuredCount}</b><small>com credenciais no servidor</small></article><article className={failedCount ? 'has-errors' : ''}><span>Precisam de atenção</span><b>{statusLoading ? '—' : failedCount}</b><small>com falha no último teste</small></article></div></section>
    <div className="ns-integration-filters" role="group" aria-label="Filtrar integracoes">{categories.map((item) => <button type="button" aria-pressed={filter === item} className={filter === item ? 'active' : ''} key={item} onClick={() => setFilter(item)}>{item}</button>)}</div>
    <div className="ns-integration-grid">{visible.map((item) => { const Icon = item.icon; const state = integrationStatus[item.name]; const tone = connectionTone(item); const testedAt = state?.testedAt ? new Date(state.testedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""; return <article className="ns-integration-card" key={item.name}><div className="ns-integration-top"><span className={`ns-integration-logo ${item.color}`}><Icon size={20} /></span><span className={`ns-connection-badge ${tone}`}><i />{connectionLabel(item)}</span></div><h3>{item.name}</h3><p>{item.detail}</p>{state?.testedAt && <small className="ns-integration-last-test" title={state.lastTestMessage || ""}>Último teste: {testedAt}</small>}<div className="ns-integration-actions"><button className="ns-integration-configure" type="button" onClick={() => { setConfiguring(item); setTestResult(null); }}><Settings2 size={14} />Detalhes e teste</button>{state?.configured && <button className={`ns-integration-toggle ${state.enabled ? "disconnect" : "reconnect"}`} type="button" disabled={changingConnection === item.name || statusLoading} onClick={() => changeConnection(item, !state.enabled)}>{changingConnection === item.name ? <RefreshCw size={14} className="ns-spinning" /> : state.enabled ? <Unplug size={14} /> : <Check size={14} />}{state.enabled ? "Desconectar" : "Reativar"}</button>}</div></article>; })}</div>
    <div className="ns-info-note"><ShieldCheck size={17} /><span><b>Segurança:</b> tokens e chaves não são exibidos no navegador. Abra uma integração para ver as variáveis exigidas, testar a conexão e consultar a última resposta do provedor.</span></div>
    {configuring && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !testing) setConfiguring(null); }}><section className="ns-integration-modal" role="dialog" aria-modal="true" aria-labelledby="integration-dialog-title"><header><span className={`ns-integration-logo ${configuring.color}`}><configuring.icon size={18} /></span><div><h2 id="integration-dialog-title">{configuring.name}</h2><p>{integrationStatus[configuring.name]?.configured ? 'Credenciais detectadas no servidor.' : 'Credenciais ausentes. Configure as variáveis no Coolify para habilitar este serviço.'}</p></div><button type="button" aria-label="Fechar" onClick={() => !testing && setConfiguring(null)}><X size={17} /></button></header><div className="integration-setup-content"><b>Variáveis necessárias</b><ul>{setup[configuring.name].vars.map((name) => <li key={name}><code>{name}</code></li>)}</ul><p>{setup[configuring.name].note}</p>{configuring.name === 'Google Workspace' && <div className="ns-integration-modal-note ns-integration-google-state"><ShieldCheck size={15} /><span>{integrationStatus['Google Workspace']?.accountEmail ? `Conta autorizada: ${integrationStatus['Google Workspace'].accountEmail}.` : integrationStatus['Google Workspace']?.configured ? 'Credenciais OAuth presentes; autorize a conta Google para concluir a conexão.' : 'Adicione GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no serviço API do Coolify antes de autorizar.'}</span><p>URI de redirecionamento: {window.location.origin}/api/integrations/google/callback</p>{integrationStatus['Google Workspace']?.accountEmail ? <button type="button" className="ns-secondary" disabled={testing} onClick={disconnectGoogle}>Desconectar conta Google</button> : <button type="button" className="ns-primary" disabled={testing || !integrationStatus['Google Workspace']?.configured} onClick={authorizeGoogle}>Autorizar conta Google</button>}</div>}<div className="ns-integration-modal-note"><ShieldCheck size={15} />As chaves permanecem no Coolify e nunca são enviadas ao navegador.</div>{testResult && <div className={`integration-test-result ${testResult.status}`} role="status"><span>{testResult.status === 'connected' ? 'Conexão confirmada' : testResult.status === 'setup_required' ? 'Integração ainda incompleta' : 'Não foi possível conectar'}</span><p>{testResult.message}</p></div>}</div><footer><button type="button" className="ns-secondary" onClick={() => refreshStatus()} disabled={statusLoading}><RefreshCw size={14} />Atualizar status</button><button type="button" className="ns-primary" onClick={testConnection} disabled={testing || (configuring.name === 'Google Workspace' && !integrationStatus['Google Workspace']?.accountEmail)}><Check size={14} />{testing ? 'Testando...' : 'Testar conexão'}</button></footer></section></div>}
  </>;
}

function WahaSessions({ notify }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [selected, setSelected] = useState(null);
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const selectedSession = sessions.find((item) => item.id === selected);
  const refresh = async () => {
    try { const result = await apiRequest('/api/integrations/waha/sessions'); setSessions(result.data || []); setError(''); }
    catch (err) { setError(err.message || 'Não foi possível carregar as sessões WAHA.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); const timer = window.setInterval(refresh, 5000); return () => window.clearInterval(timer); }, []);
  const loadQr = async (id) => {
    if (sessions.find((item) => item.id === id)?.status !== 'SCAN_QR_CODE') { setQr(''); return; }
    try { const result = await apiRequest(`/api/integrations/waha/sessions/${id}/qr`); setQr(result.data?.image ? `data:${result.data.mimetype};base64,${result.data.image}` : ''); }
    catch (err) { setQr(''); setError(err.message || 'Não foi possível gerar o QR Code.'); }
  };
  useEffect(() => {
    if (!selected) return undefined;
    if (selectedSession?.status !== 'SCAN_QR_CODE') { setQr(''); return undefined; }
    loadQr(selected);
    const timer = window.setInterval(() => loadQr(selected), 12000);
    return () => window.clearInterval(timer);
  }, [selected, selectedSession?.status]);
  const createSession = async (event) => {
    event.preventDefault(); if (!label.trim()) return;
    setBusy(true);
    try { const result = await apiRequest('/api/integrations/waha/sessions', { method: 'POST', body: JSON.stringify({ label: label.trim() }) }); setSessions((items) => [result.data, ...items]); setSelected(result.data.id); setQr(''); setNewOpen(false); setLabel(''); notify('Sessão criada. Escaneie o QR Code pelo WhatsApp do celular.'); }
    catch (err) { setError(err.message || 'Não foi possível criar a sessão WAHA.'); }
    finally { setBusy(false); }
  };
  const perform = async (item, action) => {
    if (action === 'delete' && !window.confirm(`Apagar a conexão “${item.label}”? Isso desconecta o WhatsApp e remove esta sessão do servidor.`)) return;
    if (action === 'logout' && !window.confirm(`Desconectar “${item.label}”? Será necessário ler um novo QR Code para conectar novamente.`)) return;
    setBusy(true); setError('');
    try {
      if (action === 'delete') { await apiRequest(`/api/integrations/waha/sessions/${item.id}`, { method: 'DELETE' }); setSessions((rows) => rows.filter((row) => row.id !== item.id)); if (selected === item.id) { setSelected(null); setQr(''); } notify('Sessão apagada.'); }
      else { await apiRequest(`/api/integrations/waha/sessions/${item.id}/${action}`, { method: 'POST', body: '{}' }); if (['start', 'restart', 'logout'].includes(action)) { setSelected(item.id); setQr(''); } await refresh(); notify(action === 'stop' ? 'Sessão pausada; o vínculo do celular foi preservado.' : action === 'logout' ? 'WhatsApp desconectado. Leia o novo QR para vincular novamente.' : 'Sessão WAHA atualizada.'); }
    } catch (err) { setError(err.message || 'A WAHA não concluiu esta ação.'); }
    finally { setBusy(false); }
  };
  const statusLabel = (status) => ({ WORKING: 'Conectado', SCAN_QR_CODE: 'Aguardando QR Code', STARTING: 'Iniciando', STOPPED: 'Pausado', FAILED: 'Falhou', NOT_FOUND: 'Sessão não encontrada' }[status] || status || 'Status desconhecido');
  const connected = sessions.filter((item) => item.status === 'WORKING').length;
  return <>
    <div className="ns-metrics ns-metrics-three"><Metric label="Números cadastrados" value={String(sessions.length)} note="Sessões neste workspace" icon={Smartphone} /><Metric label="Conectados" value={String(connected)} note="WhatsApp pronto para uso" icon={MessageCircle} /><Metric label="Precisam de ação" value={String(sessions.filter((item) => item.status !== 'WORKING').length)} note="QR, pausa ou reconexão" icon={AlertCircle} /></div>
    <div className="ns-section-heading"><div><h2>Conexões WhatsApp</h2><p>Adicione vários números, conecte pelo QR e controle cada sessão.</p></div><button className="ns-primary" type="button" onClick={() => setNewOpen(true)}><Plus size={15} />Adicionar número</button></div>
    {error && <div className="dashboard-data-error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Fechar">×</button></div>}
    {loading ? <div className="ns-empty-history">Carregando sessões do servidor…</div> : sessions.length === 0 ? <div className="ns-empty-history">Nenhum número conectado. Adicione um para gerar o primeiro QR Code.</div> : <div className="ns-integration-grid">{sessions.map((item) => <article className="ns-integration-card" key={item.id}><div className="ns-integration-top"><span className="ns-integration-logo whatsapp"><Smartphone size={20} /></span><span className={`ns-connection-badge ${item.status === 'WORKING' ? 'configured' : ''}`}><i />{statusLabel(item.status)}</span></div><h3>{item.label}</h3><p>{item.number || 'Número aparecerá depois da leitura do QR Code'} · {item.engine}</p><div className="ns-integration-actions">{item.status !== 'WORKING' && <button type="button" disabled={busy} onClick={() => { setSelected(item.id); if (item.status === 'FAILED') perform(item, 'restart'); else if (item.status === 'STOPPED' || item.status === 'NOT_FOUND') perform(item, 'start'); }}><Smartphone size={14} />{selected === item.id && qr ? 'QR Code aberto' : item.status === 'FAILED' ? 'Gerar novo QR Code' : 'Conectar / QR Code'}</button>}{item.status === 'WORKING' ? <button type="button" disabled={busy} onClick={() => perform(item, 'stop')}>Pausar</button> : item.status === 'STOPPED' && <button type="button" disabled={busy} onClick={() => perform(item, 'start')}>Retomar</button>}{item.status === 'WORKING' && <button type="button" disabled={busy} onClick={() => perform(item, 'logout')}>Desconectar</button>}<button type="button" className="ns-link-button danger" disabled={busy} onClick={() => perform(item, 'delete')}><Trash2 size={14} />Apagar</button></div>{selected === item.id && item.status !== 'WORKING' && <div className="ns-waha-qr">{qr ? <img src={qr} alt={`QR Code de conexão para ${item.label}`} /> : <span>{item.status === 'FAILED' ? 'Sessao falhou. Clique em Gerar novo QR Code.' : item.status === 'STARTING' ? 'Iniciando sessao...' : 'Aguardando QR Code...'}</span>}<small>WhatsApp no celular → Dispositivos conectados → Conectar dispositivo</small></div>}</article>)}</div>}
    <div className="ns-info-note"><ShieldCheck size={17} /><span>“Pausar” mantém o vínculo salvo. “Desconectar” encerra o vínculo do WhatsApp e pede nova leitura do QR. “Apagar” remove a sessão e seus dados no WAHA.</span></div>
    {newOpen && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setNewOpen(false); }}><form className="ns-integration-modal" onSubmit={createSession}><header><span className="ns-integration-logo whatsapp"><Smartphone size={18} /></span><div><h2>Adicionar número WhatsApp</h2><p>Cria uma sessão independente para este número.</p></div><button type="button" aria-label="Fechar" onClick={() => setNewOpen(false)}><X size={17} /></button></header><div className="ns-integration-fields"><label>Nome para identificar o número<input autoFocus required minLength="2" maxLength="80" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ex.: Comercial FocussDev" /></label></div><div className="ns-integration-modal-note"><ShieldCheck size={15} />Após criar, o QR Code será gerado aqui. Cada número usa uma sessão WAHA independente.</div><footer><button type="button" className="ns-secondary" onClick={() => setNewOpen(false)}>Cancelar</button><button type="submit" className="ns-primary" disabled={busy}><Plus size={14} />{busy ? 'Criando…' : 'Criar e gerar QR'}</button></footer></form></div>}
  </>;
}
const automationTemplates = [
  { id: 'new-lead-follow-up', name: 'Acompanhar lead novo', detail: 'Cria uma tarefa para responder e qualificar o contato.', trigger: 'Novo lead recebido', action: 'Criar tarefa de follow-up', systems: 'CRM + Tarefas' },
  { id: 'proposal-accepted-project', name: 'Preparar projeto vendido', detail: 'Ao aceitar a proposta, cria uma tarefa para iniciar o projeto e conferir o escopo.', trigger: 'Proposta aceita', action: 'Criar tarefa de início do projeto', systems: 'Propostas + Tarefas' },
  { id: 'payment-confirmed', name: 'Acompanhar pagamento confirmado', detail: 'O Mercado Pago atualiza a cobrança; este fluxo cria uma tarefa para a equipe revisar o recebimento.', trigger: 'Pagamento confirmado', action: 'Criar tarefa de conferência', systems: 'Mercado Pago + Tarefas' },
  { id: 'overdue-payment-reminder', name: 'Revisar cobrança vencida', detail: 'Quando uma cobrança pendente ultrapassar o vencimento, cria uma tarefa interna para conferir o pagamento no Mercado Pago e decidir se deve emitir uma nova cobrança. Não envia mensagens ao cliente.', trigger: 'Cobrança pendente vencida', action: 'Criar tarefa interna de revisão', systems: 'Financeiro + Tarefas + n8n' },
  { id: 'project-delivery-follow-up', name: 'Acompanhar entrega', detail: 'Cria um retorno alguns dias depois da publicacao do projeto.', trigger: 'Projeto publicado', action: 'Criar tarefa de acompanhamento', systems: 'Projetos + Tarefas' },
  { id: 'new-support-ticket', name: 'Atender novo chamado', detail: 'Cria uma tarefa para a equipe tratar o pedido de suporte recebido.', trigger: 'Novo ticket criado', action: 'Criar tarefa de atendimento', systems: 'Atendimento + Tarefas' },
];
const n8nSupportedTemplateIds = new Set(['new-lead-follow-up', 'proposal-accepted-project', 'payment-confirmed', 'overdue-payment-reminder', 'project-delivery-follow-up', 'new-support-ticket']);

function Automations({ notify }) {
  const { records: items, loading, error, refresh, create, update, remove: deleteRecord } = useWorkspaceRecords('automations');
  const [n8nData, setN8nData] = useState(null);
  const [n8nError, setN8nError] = useState('');
  const [n8nLoading, setN8nLoading] = useState(false);
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState('');
  const [draft, setDraft] = useState({ name: '', detail: '', trigger: 'Novo lead recebido', action: 'Criar tarefa de follow-up' });
  const triggers = [...new Set(automationTemplates.map((item) => item.trigger))];
  const actions = [...new Set(automationTemplates.map((item) => item.action))];
  const refreshN8n = useCallback(async () => {
    setN8nLoading(true);
    try { const result = await apiRequest('/api/integrations/n8n/workflows'); setN8nData(result.data); setN8nError(''); }
    catch (err) { setN8nData(null); setN8nError(err.message || 'Não foi possível consultar o n8n.'); }
    finally { setN8nLoading(false); }
  }, []);
  useEffect(() => { refreshN8n(); }, [refreshN8n]);
  const changeN8nWorkflow = async (workflow) => {
    const action = workflow.active ? 'unpublish' : 'publish';
    setBusy(`n8n:${workflow.id}`);
    try {
      await apiRequest(`/api/integrations/n8n/workflows/${encodeURIComponent(workflow.id)}/${action}`, { method: 'POST', body: '{}' });
      await Promise.all([refresh(), refreshN8n()]);
      notify(action === 'publish' ? 'Workflow publicado e confirmado pelo n8n.' : 'Workflow despublicado e confirmado pelo n8n.');
    } catch (err) { notify(err.message || 'O n8n não confirmou a alteração do workflow.'); }
    finally { setBusy(''); }
  };
  const createN8nWorkflow = async (item) => {
    setBusy(`create-n8n:${item.id}`);
    try {
      await apiRequest(`/api/workspace/automations/${encodeURIComponent(item.id)}/n8n-workflow`, { method: 'POST', body: '{}' });
      await Promise.all([refresh(), refreshN8n()]);
      notify('Workflow criado no n8n como rascunho protegido. Publique-o quando estiver pronto.');
    } catch (err) { notify(err.message || 'Não foi possível criar o workflow no n8n.'); }
    finally { setBusy(''); }
  };
  const addTemplate = async (template) => {
    if (items.some((item) => item.templateId === template.id)) { notify('Este modelo ja esta na sua lista.'); return; }
    setBusy(template.id);
    try {
      await create({ templateId: template.id, name: template.name, detail: template.detail, trigger: template.trigger, action: template.action, systems: template.systems, active: false, status: 'draft' });
      notify('Modelo adicionado como rascunho. Conecte o n8n para ativar a execucao.');
    } catch (err) { notify(err.message || 'Nao foi possivel adicionar o modelo.'); }
    finally { setBusy(''); }
  };
  const openNew = () => { setEditing(null); setDraft({ name: '', detail: '', trigger: triggers[0], action: actions[0] }); setForm(true); };
  const openEdit = (item) => { setEditing(item.id); setDraft({ name: item.name || '', detail: item.detail || '', trigger: item.trigger || triggers[0], action: item.action || actions[0] }); setForm(true); };
  const saveDraft = async (event) => {
    event.preventDefault();
    if (!draft.name.trim()) { notify('Informe um nome para a automacao.'); return; }
    setBusy('save');
    const data = { ...draft, name: draft.name.trim(), detail: draft.detail.trim(), active: false, status: 'draft' };
    try {
      if (editing) await update(editing, data); else await create(data);
      setForm(false); notify(editing ? 'Rascunho atualizado.' : 'Automacao salva como rascunho.');
    } catch (err) { notify(err.message || 'Nao foi possivel salvar a automacao.'); }
    finally { setBusy(''); }
  };
  const remove = async (item) => {
    if (!window.confirm(`Excluir o rascunho "${item.name}"?`)) return;
    try { await deleteRecord(item.id); notify('Rascunho removido.'); }
    catch (err) { notify(err.message || 'Nao foi possivel remover este rascunho.'); }
  };
  const availableTemplates = automationTemplates.filter((template) => !items.some((item) => item.templateId === template.id));
  return <>
    <div className="ns-metrics ns-metrics-three"><Metric label="Workflows no n8n" value={n8nData ? String(n8nData.workflows.length).padStart(2, '0') : '—'} note={n8nData ? `${n8nData.workflows.filter((workflow) => workflow.active).length} publicados` : 'Aguardando conexão real'} icon={Sparkles} /><Metric label="Execuções recentes" value={n8nData ? String(n8nData.executions.length).padStart(2, '0') : '—'} note="Histórico consultado no n8n" icon={Activity} /><Metric label="Modelos do workspace" value={String(items.length).padStart(2, '0')} note="Configurações salvas neste app" icon={Clock3} /></div>
    {n8nData?.deliveryQueue && <section className="ns-delivery-queue" aria-label="Estado da fila de eventos n8n"><div><span className="ns-queue-pulse" /><b>Entrega de eventos</b><small>Fila protegida contra perda e duplicidade</small></div><span><strong>{n8nData.deliveryQueue.pending}</strong> aguardando</span><span><strong>{n8nData.deliveryQueue.delivered}</strong> entregues</span><span className={n8nData.deliveryQueue.discarded ? 'has-failures' : ''}><strong>{n8nData.deliveryQueue.discarded}</strong> esgotaram tentativas</span></section>}
    <section className="ns-automation-history" aria-labelledby="n8n-workflows-title">
      <div className="ns-section-heading"><div><h2 id="n8n-workflows-title">Workflows reais do n8n</h2><p>Estado e execuções vêm da API do n8n. Publicar/despublicar altera o workflow remoto.</p></div><button type="button" className="ns-secondary" onClick={refreshN8n} disabled={n8nLoading}><RefreshCw size={14} />{n8nLoading ? 'Atualizando...' : 'Atualizar n8n'}</button></div>
      {n8nError && <div className="dashboard-data-error" role="status">{n8nError}</div>}
      {n8nLoading && !n8nData && <div className="ns-empty-history">Consultando workflows e execuções no servidor...</div>}
      {n8nData && n8nData.workflows.length === 0 && <div className="ns-empty-history">A API conectou, mas ainda não há workflows no n8n.</div>}
      {n8nData?.workflows.map((workflow) => <article className="ns-automation-row ns-n8n-workflow-row" key={workflow.id}><span className="ns-flow-icon"><Sparkles size={18} /></span><span className="ns-flow-main"><b>{workflow.name || 'Workflow sem nome'}</b><small>{workflow.triggerCount} gatilho(s) · atualizado {workflow.updatedAt ? new Date(workflow.updatedAt).toLocaleString('pt-BR') : 'sem data'}</small></span><span className={`ns-automation-status ${workflow.active ? 'is-active' : ''}`}>{workflow.active ? 'Publicado' : 'Rascunho'}</span><button type="button" className={workflow.active ? 'ns-secondary' : 'ns-primary'} disabled={busy === `n8n:${workflow.id}`} onClick={() => changeN8nWorkflow(workflow)}>{busy === `n8n:${workflow.id}` ? 'Salvando...' : workflow.active ? 'Despublicar' : 'Publicar'}</button></article>)}
      <div className="ns-section-heading ns-n8n-executions-heading"><div><h2>Execuções recentes</h2><p>Os dados de entrada/saída não são carregados para proteger informações de clientes.</p></div></div>
      {n8nData?.executions.map((run) => { const state = String(run.status || 'unknown'); const Icon = state === 'success' ? CheckCircle2 : ['error', 'crashed'].includes(state) ? AlertCircle : Clock3; return <div className="ns-run-row" key={run.id}><Icon size={15} /><span><b>{run.workflowName}</b> · {state}</span><small>{run.startedAt ? new Date(run.startedAt).toLocaleString('pt-BR') : 'Aguardando execução'}</small></div>; })}
      {n8nData && n8nData.executions.length === 0 && <div className="ns-empty-history">Nenhuma execução recente registrada no n8n.</div>}
    </section>
    <div className="ns-section-heading"><div><h2>Modelos do workspace</h2><p>Modelos compatíveis podem ser criados e publicados no n8n; modelos personalizados permanecem como rascunhos locais.</p></div><button type="button" className="ns-primary" onClick={openNew}><Plus size={15} />Criar rascunho</button></div>
    {loading && <div className="ns-empty-history">Carregando fluxos salvos...</div>}
    {error && <div className="dashboard-data-error" role="alert">{error}<button type="button" onClick={refresh}>Tentar novamente</button></div>}
    {!loading && items.length > 0 && <div className="ns-automation-list">{items.map((item) => { const linked = Boolean(item.n8nWorkflowId); const supported = n8nSupportedTemplateIds.has(item.templateId); return <article className="ns-automation-row" key={item.id}><span className={`ns-flow-icon${item.active ? ' active' : ''}`}><Sparkles size={18} /></span><span className="ns-flow-main"><b>{item.name}</b><small>{item.detail || item.systems}</small></span><span className="ns-flow-trigger"><small>Quando</small><b>{item.trigger}</b></span><span className="ns-flow-run"><small>Então</small><b>{item.action || 'Ação não configurada'}</b></span><span className={`ns-automation-status${item.active ? ' is-active' : ''}`}>{item.active ? 'Ativo no n8n' : linked ? 'Rascunho n8n' : 'Modelo local'}</span><div className="ns-automation-row-actions">{!linked && supported && <button type="button" className="ns-secondary ns-create-n8n-button" disabled={Boolean(busy)} onClick={() => createN8nWorkflow(item)}>{busy === `create-n8n:${item.id}` ? 'Criando...' : 'Criar no n8n'}</button>}<IconButton label={`Editar ${item.name}`} onClick={() => openEdit(item)}><Pencil size={15} /></IconButton><IconButton label={`Excluir ${item.name}`} onClick={() => remove(item)}><Trash2 size={15} /></IconButton></div></article>; })}</div>}
    {items.length === 0 && !loading && <div className="ns-automation-empty"><Sparkles size={19} /><div><b>Nenhum fluxo configurado</b><span>Escolha um dos modelos abaixo para comecar. Nada sera executado sem ativacao explicita.</span></div></div>}
    <div className="ns-automation-template-grid">{availableTemplates.map((template) => <article className="ns-automation-template" key={template.id}><div className="ns-automation-template-icon"><Sparkles size={17} /></div><span className="ns-automation-template-system">{template.systems}</span><h3>{template.name}</h3><p>{template.detail}</p><div className="ns-automation-template-flow"><span><small>Quando</small><b>{template.trigger}</b></span><ArrowUpRight size={14} /><span><small>Entao</small><b>{template.action}</b></span></div><button type="button" className="ns-secondary" disabled={busy === template.id} onClick={() => addTemplate(template)}><Plus size={14} />{busy === template.id ? 'Adicionando...' : 'Adicionar fluxo'}</button></article>)}</div>
    <div className="ns-info-note"><ShieldCheck size={17} /><span>Criar no n8n gera um webhook autenticado ligado ao evento do modelo. Ao publicar, os eventos correspondentes do Nexo acionam a automação; as ações criam tarefas no workspace sem duplicar os acompanhamentos nativos.</span></div>
    {form && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setForm(false); }}><form className="ns-integration-modal ns-automation-modal" onSubmit={saveDraft}><header><span className="ns-integration-logo sign"><Sparkles size={18} /></span><div><h2>{editing ? 'Editar rascunho' : 'Criar rascunho'}</h2><p>Esta configuração fica salva no workspace.</p></div><button type="button" aria-label="Fechar" onClick={() => setForm(false)}><X size={17} /></button></header><div className="ns-integration-fields"><label>Nome<input autoFocus required maxLength="70" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex.: Acompanhar novo cliente" /></label><label>Descrição<input value={draft.detail} onChange={(event) => setDraft({ ...draft, detail: event.target.value })} placeholder="O que este fluxo deve fazer?" /></label><label>Quando isso acontecer<select value={draft.trigger} onChange={(event) => setDraft({ ...draft, trigger: event.target.value })}>{triggers.map((item) => <option key={item}>{item}</option>)}</select></label><label>Então fazer<select value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value })}>{actions.map((item) => <option key={item}>{item}</option>)}</select></label></div><div className="ns-integration-modal-note"><ShieldCheck size={15} />Salvar não cria nem executa um workflow no n8n.</div><footer><button type="button" className="ns-secondary" onClick={() => setForm(false)}>Cancelar</button><button type="submit" className="ns-primary" disabled={busy === 'save'}><Check size={14} />{busy === 'save' ? 'Salvando...' : editing ? 'Salvar rascunho' : 'Criar rascunho'}</button></footer></form></div>}
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
  else if (currentPage === 'caixa_entrada') activeContent = <Inbox notify={notify} />;
  else if (currentPage === 'whatsapp') activeContent = <WahaSessions notify={notify} />;
  else if (currentPage === 'tickets') activeContent = <Tickets notify={notify} />;
  else if (['sites', 'dominios', 'hospedagens', 'monitoramento'].includes(currentPage)) activeContent = <Sites page={currentPage} notify={notify} />;
  else if (currentPage === 'integracoes') activeContent = <Integrations notify={notify} />;
  else activeContent = <Automations notify={notify} />;
  return <main className="ns-screen"><div className="ns-screen-inner"><PageHeading page={currentPage} action={newAction} onAction={headerAction} />{activeContent}</div><Toast message={toast} onClose={() => setToast('')} /></main>;
}

export default ServiceScreen;
