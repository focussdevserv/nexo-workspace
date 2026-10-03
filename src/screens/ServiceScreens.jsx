import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, AlertCircle, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BadgeCheck, Bell, CalendarClock,
  Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, Copy, Download,
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
import { apiRequest, fetchAllRecords, useWorkspaceRecords } from '../lib/workspace-api.js';
import { buildCashflowMonths, filterFinanceRecords, financeOverviewActivityRows, financeRecordActionKey, financeRecordsCsv, isFinanceReceivableOpen, isFinanceRecordOverdue } from '../lib/finance-cashflow.js';
import { financeEntryActionForStatus } from '../lib/finance-entry-action.js';
import { filterFinanceAccountTransactions, financeAccountTransactionSignedAmount } from '../lib/finance-account-transactions.js';
import { canDeleteFinanceAccountTransaction } from '../lib/finance-transaction-actions.js';
import { resolveFinanceClientLink } from '../lib/finance-client-link.js';
import { parseDisplayAmount } from '../lib/client-billing-summary.js';
import { filterInboxConversations } from '../lib/inbox-filter.js';
import { normalizeInboxChannel, resolveInboxConversationNavigation } from '../lib/inbox-navigation.js';
import { markInboxConversationRead } from '../lib/inbox-read-state.js';
import { preferredInboxSessionId } from '../lib/inbox-session.js';
import { gmailThreadMetadataRecord, hostingerThreadMetadataRecord, mergeGmailThreadMetadata, mergeHostingerThreadMetadata } from '../lib/gmail-thread-metadata.js';
import { matchConversationClient } from '../lib/conversation-client-match.js';
import { canReplyToInboxConversation, isResolvedInboxConversation, nextInboxConversationStatus } from '../lib/inbox-reply.js';
import { sendInboxMessage } from '../lib/inbox-send.js';
import { buildInboxFollowUpTask, nextInboxFollowUpDate } from '../lib/inbox-follow-up.js';
import { normalizeWhatsAppChatId } from '../lib/whatsapp-phone.js';
import { canManageWahaSessions, canOfferWahaConnectAction, canShowWahaQr, wahaQrSessionMessage } from '../lib/waha-session-access.js';
import { createAsyncActionLock } from '../lib/async-action-lock.js';
import { beginSiteCheck, finishSiteCheck } from '../lib/site-check-state.js';
import { filterTableRows, tableStatusOptions } from '../lib/table-status-filter.js';
import { countOverdueTickets, ticketSlaDeadline, ticketSlaLabel } from '../lib/ticket-sla.js';
import { normalizeTicketPriority, ticketPriorityLabel } from '../lib/ticket-priority.js';
import { normalizeTicketStatus, ticketStatusOptions } from '../lib/ticket-status.js';
import { findTicketByActionKey } from '../lib/ticket-record-selection.js';
import { availableInboxEmailProviders } from '../lib/inbox-email-providers.js';
import { ticketAssigneeFromOption, ticketAssigneeOptionValue } from '../lib/ticket-assignee.js';
import { filterSupportTickets, ticketQueueFilters } from '../lib/ticket-filter.js';
import { downloadCsvFile, rowsToCsv } from '../lib/csv.js';
import { canAuthorizeOAuthIntegrations, googleReauthorizationButtonState, integrationOAuthRedirectUri, integrationStatusLabel, integrationStatusTone, mercadoPagoAuthorizationButtonState } from '../lib/integration-auth-state.js';
import { googleEmailErrorAction } from '../lib/google-email-error.js';
import { appendUniqueN8nWorkflows } from '../lib/n8n-workflows.js';
import { automationActionOptions, automationDraftForEdit, defaultAutomationAction } from '../lib/automation-options.js';
import { n8nSetupActionRequired } from '../lib/n8n-screen-state.js';
import { isLocalDemoActive } from '../lib/local-demo.js';
import { createLatestRequestGuard } from '../lib/latest-request.js';
import { startGithubActivityRequest } from '../lib/github-activity-request.js';
import { buildSiteAssetPayload, siteAssetUrlForEdit, siteMonitorIntervalForAsset, siteMonitorScheduleState, siteMonitorSchedulesForAsset } from '../lib/site-asset.js';
import { canRemoveSiteAsset } from '../lib/site-asset-removal.js';
import { siteRenewalDate, summarizeSiteRenewals } from '../lib/site-renewal.js';
import { confirmWorkspaceDelete, useWorkspacePreferences } from '../lib/workspace-preferences.js';

function useStoredArray(key, fallback) {
  const resources = { 'nexo.finance.receitas.v1': 'revenues', 'nexo.finance.despesas.v1': 'expenses', 'nexo.finance.accounts.v1': 'finance-accounts', 'nexo.finance.transactions.v1': 'finance-transactions', 'nexo.support.conversations.v1': 'inbox', 'nexo.sites.assets.v1': 'site-assets', 'nexo.sites.monitors.v1': 'monitors' };
  const resource = resources[key];
  const path = key === 'nexo.billing.v1' ? '/api/billing/orders' : `/api/workspace/${resource}`;
  const [value, setValue] = useState([]);
  const [loading, setLoading] = useState(Boolean(resource));
  const ref = useRef(value);
  const refresh = useCallback(async () => { try { ref.current = await fetchAllRecords(path); setValue(ref.current); return ref.current; } finally { setLoading(false); } }, [path]);
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
  return [value, persist, refresh, loading];
}

const initialMessages = [];


const assets = [];

const monitors = [];

const integrations = [
  { name: 'Mercado Pago', detail: 'Cobranças, pagamentos e recorrências', icon: CreditCard, color: 'mercado', fields: [['accessToken', 'Access token', true], ['publicKey', 'Public key', false]] },
  { name: 'Evolution API', detail: 'Instâncias, conversas e notificações WhatsApp', icon: MessageCircle, color: 'whatsapp', fields: [['baseUrl', 'URL da API', false], ['instance', 'Nome da instância', false], ['apiKey', 'API key', true]] },
  { name: 'WAHA', detail: 'Sessões WhatsApp e mensagens', icon: Smartphone, color: 'whatsapp', fields: [['baseUrl', 'URL da API', false], ['session', 'Nome da sessão', false], ['apiKey', 'API key', true]] },
  { name: 'Resend', detail: 'E-mails de propostas e notificações', icon: Mail, color: 'google', fields: [['apiKey', 'API key', true], ['fromEmail', 'E-mail remetente', false]] },
  { name: 'Hostinger E-mail', detail: 'Caixa postal por IMAP e SMTP', icon: Mail, color: 'google', fields: [] },
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
  caixa_entrada: ['Caixa de entrada', 'Conversas de WhatsApp e e-mail em um só lugar.'],
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
function localDateInput(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
async function encodeAttachmentFile(file) {
  if (!file || file.size <= 0 || file.size > 8 * 1024 * 1024) throw new Error('Escolha um arquivo entre 1 byte e 8 MiB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + 0x8000, bytes.length)));
  return btoa(binary);
}

function navigateTo(label) { window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: label })); }

function IconButton({ label, onClick, children, disabled = false }) {
  return <button className="ns-icon-button" type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}>{children}</button>;
}

function PageHeading({ page, action, onAction }) {
  const [title, subtitle] = pageInfo[page];
  return <div className="ns-heading"><div><span className="ns-crumb">Focusshub <ChevronRight size={13} /> {page === 'caixa_entrada' || page === 'whatsapp' || page === 'tickets' ? 'Atendimento' : ['sites', 'dominios', 'hospedagens', 'monitoramento', 'integracoes', 'automacoes'].includes(page) ? 'Operações técnicas' : 'Financeiro'}</span><h1>{title}</h1><p>{subtitle}</p></div>{action && <button type="button" className="ns-primary" onClick={onAction}><Plus size={16} />{action}</button>}</div>;
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

function DataTable({ columns, rows, search, onAction, onEdit, actionLabel = 'Mais opções', actionIcon: ActionIcon = MoreHorizontal, actionDisabled = () => false, empty = 'Nenhum registro encontrado.', statusIndex, hideActions = false }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const statusColumn = statusIndex ?? (rows[0]?.length ?? 1) - 1;
  const shown = filterTableRows(rows, { query, status: filter, statusColumn });
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageRows = shown.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstRow = shown.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastRow = Math.min(currentPage * pageSize, shown.length);
  const updateFilter = (value) => { setFilter(value); setPage(1); };
  const updateQuery = (value) => { setQuery(value); setPage(1); };
  return <section className="ns-panel ns-table-panel">
    <div className="ns-panel-toolbar"><div className="ns-filter-tabs">{tableStatusOptions(rows, statusColumn).map((item) => <button className={filter === item ? 'selected' : ''} key={item} onClick={() => updateFilter(item)} type="button">{item}</button>)}</div><div className="ns-tools">{search && <label className="ns-search"><Search size={15} /><input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="Buscar" /></label>}<IconButton label={'Limpar filtros'} disabled={filter === 'Todos' && !query} onClick={() => { updateFilter('Todos'); updateQuery(''); }}><Filter size={15} /></IconButton></div></div>
    <div className="ns-table-scroll"><table className="ns-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}{!hideActions && <th aria-label={'Ações'} />}</tr></thead><tbody>{pageRows.map((row, index) => <tr key={row.recordId ?? `${row[0]}-${index}`}>{row.slice(0, columns.length).map((cell, cellIndex) => <td key={cellIndex}>{cellIndex === statusColumn ? <Status>{cell}</Status> : cellIndex === 0 ? <b className="ns-row-id">{cell}</b> : cell}</td>)}{!hideActions && <td>{onEdit && <IconButton label={`Editar ${row[0]}`} onClick={() => onEdit(row.recordId ?? row[0])}><Pencil size={15} /></IconButton>}<IconButton label={typeof actionLabel === 'function' ? actionLabel(row) : actionLabel} disabled={actionDisabled(row)} onClick={() => onAction?.(row.recordId ?? `Opções de ${row[0]}`)}><ActionIcon size={17} /></IconButton></td>}</tr>)}{shown.length === 0 && <tr><td className="ns-empty" colSpan={columns.length + (hideActions ? 0 : 1)}>{empty}</td></tr>}</tbody></table></div>
    <div className="ns-table-footer"><span>Mostrando {firstRow}-{lastRow} de {shown.length} registros</span><div><button type="button" aria-label={'Página anterior'} disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={15} /></button><b aria-live="polite">{currentPage} / {pageCount}</b><button type="button" aria-label={'Próxima página'} disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}><ChevronRight size={15} /></button></div></div>
  </section>;
}
function FinanceOverview({ notify, onCreate }) {
  const [revenues] = useStoredArray('nexo.finance.receitas.v1', []);
  const [expenses] = useStoredArray('nexo.finance.despesas.v1', []);
  const [billing] = useStoredArray('nexo.billing.v1', []);
  const [accounts] = useStoredArray('nexo.finance.accounts.v1', []);
  const sumRows = (rows) => rows.reduce((sum, row) => sum + parseDisplayAmount(Array.isArray(row) ? row[4] : row.amount), 0);
  const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);
  const openBills = billing.filter(isFinanceReceivableOpen);
  const normalizeRows = (rows) => rows.map((row) => Array.isArray(row) ? { code: row[0], description: row[1], counterparty: row[1], date: row[3], amount: parseDisplayAmount(row[4]), status: row[5] } : { ...row, amount: parseDisplayAmount(row.amount) });
  const incomeRows = normalizeRows(revenues); const expenseRows = normalizeRows(expenses);
  const chartValues = buildCashflowMonths(incomeRows, expenseRows);
  const chartMax = Math.max(1, ...chartValues.flatMap((item) => [item.incomeRealized, item.incomeForecast, item.expenseRealized, item.expenseForecast]));
  const hasCashflow = chartValues.some((item) => item.incomeRealized || item.incomeForecast || item.expenseRealized || item.expenseForecast);
  const recent = financeOverviewActivityRows(incomeRows, expenseRows, 8);
  return <>
    <div className="ns-metrics ns-metrics-four ns-finance-metrics"><Metric label="Saldo registrado" value={money(totalBalance)} note={`${accounts.length} contas cadastradas`} icon={Wallet} /><Metric label="Receitas cadastradas" value={money(sumRows(revenues))} note={`${revenues.length} lançamentos`} icon={ArrowDownLeft} /><Metric label="Despesas cadastradas" value={money(sumRows(expenses))} note={`${expenses.length} lançamentos`} icon={ArrowUpRight} /><Metric label="A receber" value={money(openBills.reduce((sum, bill) => sum + Number(bill.amount || 0), 0))} note={`${openBills.length} cobranças abertas`} icon={Clock3} /></div>
    <div className="ns-finance-grid"><section className="ns-panel ns-cash-panel"><div className="ns-panel-title"><div><h2>Fluxo de caixa</h2><p>Realizado e previsto · 3 meses anteriores e próximos 2</p></div><span className="ns-select">Dados cadastrados</span></div>{hasCashflow ? <><div className="ns-chart-legend"><span><i className="income-dot" />Receita realizada</span><span><i className="income-forecast-dot" />Receita prevista</span><span><i className="expense-realized-dot" />Despesa paga</span><span><i className="expense-forecast-dot" />Despesa prevista</span></div><div className="ns-chart" role="img" aria-label="Fluxo mensal com receitas e despesas realizadas ou previstas">{[0,1,2,3].map((line)=><i className="ns-chart-guide" key={line}/>)}<div className="ns-chart-months">{chartValues.map((item)=><div className="ns-chart-month" key={`${item.month.getFullYear()}-${item.month.getMonth()}`}><div className="ns-chart-bars"><i title={`Receita realizada ${money(item.incomeRealized)}`} style={{height:`${Math.max(4,item.incomeRealized/chartMax*100)}%`}}/><i title={`Receita prevista ${money(item.incomeForecast)}`} style={{height:`${Math.max(4,item.incomeForecast/chartMax*100)}%`}}/><i title={`Despesa paga ${money(item.expenseRealized)}`} style={{height:`${Math.max(4,item.expenseRealized/chartMax*100)}%`}}/><i title={`Despesa prevista ${money(item.expenseForecast)}`} style={{height:`${Math.max(4,item.expenseForecast/chartMax*100)}%`}}/></div><small>{item.month.toLocaleDateString('pt-BR',{month:'short'})}</small></div>)}</div></div></> : <div className="ns-chart-empty" role="status"><span><TrendingUp size={18} /></span><b>Sem movimentações no período</b><small>Cadastre receitas ou despesas para visualizar o fluxo de caixa.</small></div>}</section>
      <section className="ns-panel ns-attention"><div className="ns-panel-title"><div><h2>Precisa de atenção</h2><p>Itens que pedem uma ação</p></div><Bell size={17} /></div>{openBills.length ? <button onClick={() => navigateTo('Cobranças')} type="button"><span className="ns-attention-icon orange"><Clock3 size={16} /></span><span><b>{openBills.length} cobrança(s) em aberto</b><small>Veja os vencimentos e pagamentos registrados.</small></span><ChevronRight size={16} /></button> : <p className="ns-empty">Nenhuma cobrança em aberto.</p>}</section></div>
    <div className="ns-section-heading"><div><h2>Movimentações recentes</h2><p>Últimas entradas e saídas registradas</p></div><button type="button" className="ns-text-button" onClick={() => navigateTo('Receitas')}>Ver receitas <ChevronRight size={15} /></button></div>
    <DataTable columns={['Descrição', 'Cliente / categoria', 'Data', 'Valor', 'Status']} rows={recent} search hideActions />
  </>;
}

function Accounts({ notify }) {
  const preferences = useWorkspacePreferences();
  const accountKey = 'nexo.finance.accounts.v1';
  const [accounts, , refreshAccounts] = useStoredArray(accountKey, []);
  const [transactions, , refreshTransactions] = useStoredArray('nexo.finance.transactions.v1', []);
  const [modal, setModal] = useState(false);
  const [entryModal, setEntryModal] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [editing, setEditing] = useState('');
  const [selected, setSelected] = useState('Todas');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [draft, setDraft] = useState({ name: '', bank: '', balance: '0' });
  const [transactionDraft, setTransactionDraft] = useState(() => ({ description: '', accountId: '', direction: 'Entrada', amount: '', date: localDateInput(), idempotencyKey: crypto.randomUUID() }));
  const [transferDraft, setTransferDraft] = useState(() => ({ description: 'Transferir entre contas', sourceAccountId: '', destinationAccountId: '', amount: '', date: localDateInput(), idempotencyKey: crypto.randomUUID() }));
  const todayInput = localDateInput;
  const editingAccount = accounts.find((account) => String(account.id) === String(editing));
  const openNew = () => { setEditing(''); setDraft({ name: '', bank: '', balance: '0' }); setSaveError(''); setModal(true); };
  const openEdit = (account) => { setEditing(String(account.id)); setDraft({ name: account.name, bank: account.bank, balance: String(account.balance) }); setSaveError(''); setModal(true); };
  const save = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (!draft.name.trim() || !draft.bank.trim() || !Number.isFinite(Number(draft.balance))) { setSaveError('Informe nome, instituição e um saldo válido.'); return; }
    setSaving(true); setSaveError('');
    const data = { name: draft.name.trim(), bank: draft.bank.trim(), ...(editingAccount ? {} : { balance: Number(draft.balance) }), color: editingAccount?.color || 'green' };
    try {
      if (editingAccount) await apiRequest(`/api/workspace/finance-accounts/${editingAccount.id}`, { method: 'PATCH', body: JSON.stringify({ data }) });
      else await apiRequest('/api/workspace/finance-accounts', { method: 'POST', body: JSON.stringify({ data }) });
      setModal(false);
      try { await refreshAccounts(); notify(editingAccount ? 'Conta atualizada no workspace.' : 'Conta cadastrada no workspace.'); }
      catch (error) { setSaveError(`A API confirmou o salvamento, mas a lista não atualizou. Recarregue os registros. ${error.message || ''}`); }
    } catch (error) { setSaveError(error.message || 'Não foi possível salvar a conta.'); }
    finally { setSaving(false); }
  };
  const remove = async (account) => {
    if (saving || !confirmWorkspaceDelete(`Remover ${account.name} e as movimentações vinculadas?`, preferences)) return;
    setSaving(true); setSaveError('');
    try {
      await apiRequest(`/api/workspace/finance-accounts/${account.id}`, { method: 'DELETE' });
      try { await Promise.all([refreshAccounts(), refreshTransactions()]); notify('Conta e movimentações vinculadas removidas do workspace.'); }
      catch (error) { setSaveError(`A API confirmou a remoção, mas as listas não atualizaram. Recarregue os registros. ${error.message || ''}`); }
    } catch (error) { setSaveError(error.message || 'Não foi possível remover a conta.'); }
    finally { setSaving(false); }
  };
  const addTransaction = async (event) => {
    event.preventDefault();
    if (saving) return;
    const account = accounts.find((item) => String(item.id) === String(transactionDraft.accountId));
    const amount = Number(transactionDraft.amount);
    if (!account || !transactionDraft.description.trim() || !transactionDraft.date || !Number.isFinite(amount) || amount <= 0) { setSaveError('Preencha descrição, conta, data e valor válidos.'); return; }
    setSaving(true); setSaveError('');
    const data = { description: transactionDraft.description.trim(), direction: transactionDraft.direction, amount, date: transactionDraft.date };
    try {
      const response = await apiRequest(`/api/workspace/finance-accounts/${account.id}/transactions`, { method: 'POST', body: JSON.stringify({ ...data, idempotencyKey: transactionDraft.idempotencyKey }) });
      setEntryModal(false); setTransactionDraft({ description: '', accountId: account.id, direction: 'Entrada', amount: '', date: todayInput(), idempotencyKey: crypto.randomUUID() });
      try { await Promise.all([refreshAccounts(), refreshTransactions()]); notify(response.replayed ? 'Esta movimentação já estava registrada; nenhuma duplicata foi criada.' : 'Movimentação registrada no workspace.'); }
      catch (error) { setSaveError(`A API confirmou o registro, mas a lista não atualizou. Recarregue os registros. ${error.message || ''}`); }
    } catch (error) { setSaveError(error.message || 'Não foi possível registrar a movimentação.'); }
    finally { setSaving(false); }
  };
  const submitTransfer = async (event) => {
    event.preventDefault();
    if (saving) return;
    const amount = Number(transferDraft.amount);
    const source = accounts.find((account) => String(account.id) === String(transferDraft.sourceAccountId));
    const destination = accounts.find((account) => String(account.id) === String(transferDraft.destinationAccountId));
    if (!source || !destination || String(source.id) === String(destination.id) || !transferDraft.description.trim() || !transferDraft.date || !Number.isFinite(amount) || amount <= 0) {
      setSaveError('Escolha duas contas diferentes e informe descricao, data e valor validos.'); return;
    }
    if (Math.round(amount * 100) > Math.round(Number(source.balance || 0) * 100)) {
      setSaveError(`Saldo insuficiente em ${source.name}. Ajuste o valor ou escolha outra conta de origem.`);
      return;
    }
    setSaving(true); setSaveError('');
    try {
      await apiRequest('/api/workspace/finance-transfers', { method: 'POST', body: JSON.stringify({ ...transferDraft, description: transferDraft.description.trim(), amount }) });
      setTransferModal(false);
      try { await Promise.all([refreshAccounts(), refreshTransactions()]); notify('Transferencia registrada nas duas contas.'); }
      catch (error) { setSaveError(`A API confirmou a transferencia, mas as listas nao atualizaram. Recarregue os registros. ${error.message || ''}`); }
    } catch (error) { setSaveError(error.message || 'Nao foi possivel registrar a transferencia.'); }
    finally { setSaving(false); }
  };
  const exportCsv = () => {
    const rows = [['Conta', 'Instituição', 'Descrição', 'Tipo', 'Data', 'Valor', 'Status'], ...visibleTransactions.map((row) => {
      const account = accounts.find((item) => String(item.id) === String(row.accountId));
      const date = row.date ? new Date(`${String(row.date).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '';
      const value = (row.direction === 'Saída' ? -1 : 1) * Math.abs(Number(row.amount) || 0);
      return [account?.name || row.accountName || '', account?.bank || account?.institution || '', row.description || '', row.direction || '', date, value.toFixed(2), row.status || 'Registrada'];
    })];
    downloadCsvFile('nexo-movimentacoes.csv', rowsToCsv(rows)); notify('CSV das movimentações exportado.');
  };
  const visibleTransactions = filterFinanceAccountTransactions(transactions, selected, accounts);
  const total = accounts.reduce((sum, account) => sum + Number(account.balance), 0);
  const actionRows = visibleTransactions.map((row) => Object.assign([row.description || 'Movimentação', row.accountName || 'Conta não informada', row.date ? new Date(`${String(row.date).slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR') : '', money(financeAccountTransactionSignedAmount(row)), row.status || 'Registrada'], { recordId: row.id, transaction: row }));
  const removeTransaction = async (transactionId) => {
    if (saving) return;
    const transaction = visibleTransactions.find((item) => String(item.id) === String(transactionId));
    if (!transaction) return setSaveError('Esta movimentação não está mais disponível. Atualize a lista.');
    if (!canDeleteFinanceAccountTransaction(transaction)) return setSaveError('Esta movimentação faz parte de uma transferência e não pode ser removida separadamente.');
    const confirmation = `Remover a movimentação "${transaction.description || 'sem descrição'}" de ${money(Math.abs(Number(transaction.amount) || 0))}? O saldo será ajustado automaticamente.`;
    if (!confirmWorkspaceDelete(confirmation, preferences)) return;
    setSaving(true); setSaveError('');
    try {
      await apiRequest(`/api/workspace/finance-transactions/${transaction.id}`, { method: 'DELETE' });
      try {
        await Promise.all([refreshAccounts(), refreshTransactions()]);
        notify('Movimentação removida e saldo recalculado no workspace.');
      } catch (error) {
        setSaveError(`A API confirmou a remoção, mas as listas não atualizaram. Recarregue os registros. ${error.message || ''}`);
      }
    } catch (error) { setSaveError(error.message || 'Não foi possível remover a movimentação.'); }
    finally { setSaving(false); }
  };
  return <>
    <div className="ns-metrics ns-metrics-three"><Metric label="Saldo total registrado" value={money(total)} note={`${accounts.length} contas`} icon={Wallet} /><Metric label="Contas conectadas" value="0" note="Nenhum provedor conectado" icon={Link2} /><Metric label="Movimentações" value={String(transactions.length).padStart(2, '0')} note="Registros do workspace" icon={Activity} /></div>
    {saveError && <div className="dashboard-data-error" role="alert">{saveError}<button type="button" onClick={() => setSaveError('')}>Fechar</button></div>}
    <div className="ns-section-heading"><div><h2>Suas contas</h2><p>Cadastre contas e acompanhe saldos e movimentações.</p></div><button className="ns-primary" type="button" disabled={saving} onClick={openNew}><Plus size={15} />Adicionar conta</button></div>
    <div className="ns-account-grid">{accounts.map((account) => <article className="ns-account-card" key={account.id}><div className="ns-account-head"><span className={`ns-bank-icon ${account.color}`}><Wallet size={19} /></span><div className="ns-account-actions"><IconButton label={`Editar ${account.name}`} disabled={saving} onClick={() => openEdit(account)}><Pencil size={15} /></IconButton><IconButton label={`Remover ${account.name}`} disabled={saving} onClick={() => remove(account)}><Trash2 size={15} /></IconButton></div></div><small>{account.name}</small><b>{money(Number(account.balance))}</b><span>{account.bank}</span><button type="button" disabled={saving} onClick={() => setSelected(String(account.id))}>Ver movimentações <ChevronRight size={15} /></button></article>)}<button type="button" className="ns-add-account" disabled={saving} onClick={openNew}><span><Plus size={18} /></span><b>Adicionar conta</b><small>Registre uma conta e saldo inicial</small></button></div>
    <div className="ns-section-heading ns-account-section-heading"><div><h2>Movimentações recentes</h2><p>{selected === 'Todas' ? 'Entradas e saídas das contas' : `Movimentações de ${accounts.find((account) => String(account.id) === String(selected))?.name || 'conta selecionada'}`} <button className="ns-link-button" type="button" onClick={() => setSelected('Todas')}>Ver todas</button></p></div><div className="ns-account-actions ns-account-toolbar-actions"><button className="ns-secondary" type="button" disabled={saving || accounts.length < 2} onClick={() => { setSaveError(''); setTransferDraft({ description: 'Transferir entre contas', sourceAccountId: String(accounts[0]?.id || ''), destinationAccountId: String(accounts[1]?.id || ''), amount: '', date: todayInput(), idempotencyKey: crypto.randomUUID() }); setTransferModal(true); }}><ArrowLeftRight size={14} />Transferir entre contas</button><button className="ns-secondary" type="button" disabled={saving || accounts.length === 0} onClick={() => { setSaveError(''); setTransactionDraft({ description: '', accountId: selected !== 'Todas' ? selected : String(accounts[0]?.id || ''), direction: 'Entrada', amount: '', date: todayInput(), idempotencyKey: crypto.randomUUID() }); setEntryModal(true); }}><Plus size={14} />Registrar movimentação</button><button className="ns-text-button" type="button" onClick={exportCsv}>Exportar <ExternalLink size={14} /></button></div></div>
    <div aria-busy={saving}><DataTable columns={['Lançamento', 'Conta', 'Data', 'Valor', 'Status']} rows={actionRows} search onAction={removeTransaction} actionLabel={(row) => row.transaction?.transferId ? 'Transferência protegida' : 'Remover movimentação'} actionIcon={Trash2} actionDisabled={(row) => !canDeleteFinanceAccountTransaction(row.transaction)} /></div>
    <div className="ns-info-note"><ShieldCheck size={17} /><span>Os saldos são informados manualmente; esta tela não se conecta a bancos nem sincroniza transações.</span></div>
    {modal && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setModal(false); }}><form className="ns-integration-modal" aria-busy={saving} onSubmit={save}><header><span className="ns-integration-logo mercado"><Wallet size={18} /></span><div><h2>{editingAccount ? 'Editar conta' : 'Adicionar conta'}</h2><p>Controle interno manual, sem conexão bancária.</p></div><button type="button" aria-label="Fechar" disabled={saving} onClick={() => setModal(false)}><X size={17} /></button></header><div className="ns-integration-fields"><label>Nome da conta<input autoFocus required disabled={saving} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex.: Conta principal" /></label><label>Banco ou instituição<input required disabled={saving} value={draft.bank} onChange={(event) => setDraft({ ...draft, bank: event.target.value })} placeholder="Ex.: Nubank" /></label><label>{editingAccount ? 'Saldo atual' : 'Saldo inicial'}<input type="number" step="0.01" disabled={saving || Boolean(editingAccount)} value={draft.balance} onChange={(event) => setDraft({ ...draft, balance: event.target.value })} /></label>{editingAccount && <p className="ns-recurrence-note">O saldo acompanha o histórico de movimentações. Para ajustá-lo, registre uma entrada ou saída.</p>}</div>{saveError && <div className="dashboard-data-error" role="alert">{saveError}</div>}<footer><button className="ns-secondary" type="button" disabled={saving} onClick={() => setModal(false)}>Cancelar</button><button className="ns-primary" type="submit" disabled={saving}><Check size={14} />{saving ? 'Salvando...' : 'Salvar conta'}</button></footer></form></div>}
    {entryModal && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEntryModal(false); }}><form className="ns-integration-modal" aria-busy={saving} onSubmit={addTransaction}><header><span className="ns-integration-logo mercado"><Activity size={18} /></span><div><h2>Registrar movimentação</h2><p>Lançamento manual no controle da conta.</p></div><button type="button" aria-label="Fechar" disabled={saving} onClick={() => setEntryModal(false)}><X size={17} /></button></header><div className="ns-integration-fields"><label>Descrição<input autoFocus required disabled={saving} value={transactionDraft.description} onChange={(event) => setTransactionDraft({ ...transactionDraft, description: event.target.value })} placeholder="Ex.: Pagamento de hospedagem" /></label><label>Conta<select required disabled={saving} value={transactionDraft.accountId} onChange={(event) => setTransactionDraft({ ...transactionDraft, accountId: event.target.value })}><option value="">Selecione uma conta</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} - {account.bank}</option>)}</select></label><label>Tipo<select disabled={saving} value={transactionDraft.direction} onChange={(event) => setTransactionDraft({ ...transactionDraft, direction: event.target.value })}><option value="Entrada">Entrada</option><option value={'Saída'}>Sa&iacute;da</option></select></label><label>Data<input required disabled={saving} type="date" value={transactionDraft.date} onChange={(event) => setTransactionDraft({ ...transactionDraft, date: event.target.value })} /></label><label>Valor<input required disabled={saving} type="number" min="0.01" step="0.01" value={transactionDraft.amount} onChange={(event) => setTransactionDraft({ ...transactionDraft, amount: event.target.value })} placeholder="0,00" /></label></div>{saveError && <div className="dashboard-data-error" role="alert">{saveError}</div>}<div className="ns-integration-modal-note"><ShieldCheck size={15} />A movimentação fica salva no workspace, não importa extrato bancário.</div><footer><button className="ns-secondary" type="button" disabled={saving} onClick={() => setEntryModal(false)}>Cancelar</button><button className="ns-primary" type="submit" disabled={saving || !accounts.length}><Check size={14} />{saving ? 'Salvando...' : 'Registrar'}</button></footer></form></div>}
    {transferModal && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setTransferModal(false); }}><form className="ns-integration-modal" aria-busy={saving} onSubmit={submitTransfer}><header><span className="ns-integration-logo mercado"><ArrowLeftRight size={18} /></span><div><h2>Transferir entre contas</h2><p>Debito e credito ficam registrados juntos.</p></div><button type="button" aria-label="Fechar" disabled={saving} onClick={() => setTransferModal(false)}><X size={17} /></button></header><div className="ns-integration-fields"><label>Conta de origem<select required disabled={saving} value={transferDraft.sourceAccountId} onChange={(event) => setTransferDraft({ ...transferDraft, sourceAccountId: event.target.value })}><option value="">Selecione a origem</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} - {money(Number(account.balance))}</option>)}</select></label><label>Conta de destino<select required disabled={saving} value={transferDraft.destinationAccountId} onChange={(event) => setTransferDraft({ ...transferDraft, destinationAccountId: event.target.value })}><option value="">Selecione o destino</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label>Descricao<input required maxLength="240" disabled={saving} value={transferDraft.description} onChange={(event) => setTransferDraft({ ...transferDraft, description: event.target.value })} /></label><label>Data<input required disabled={saving} type="date" value={transferDraft.date} onChange={(event) => setTransferDraft({ ...transferDraft, date: event.target.value })} /></label><label>Valor<input required disabled={saving} type="number" min="0.01" step="0.01" value={transferDraft.amount} onChange={(event) => setTransferDraft({ ...transferDraft, amount: event.target.value })} /></label></div>{saveError && <div className="dashboard-data-error" role="alert">{saveError}</div>}<div className="ns-integration-modal-note"><ShieldCheck size={15} />O saldo de origem deve cobrir o valor. Nenhum banco e movimentado.</div><footer><button className="ns-secondary" type="button" disabled={saving} onClick={() => setTransferModal(false)}>Cancelar</button><button className="ns-primary" type="submit" disabled={saving || accounts.length < 2}><ArrowLeftRight size={14} />{saving ? 'Transferindo...' : 'Confirmar transferencia'}</button></footer></form></div>}
  </>;
}
function FinanceList({ page, notify, navigationContext = null, onNavigationContextConsumed = () => {} }) {
  const preferences = useWorkspacePreferences();
  const titles = { receitas: ['Lançamento', 'Cliente / descrição', 'Data', 'Valor', 'Status'], despesas: ['Lançamento', 'Fornecedor / categoria', 'Data', 'Valor', 'Status'] };
  const resourceKey = page === 'despesas' ? 'nexo.finance.despesas.v1' : 'nexo.finance.receitas.v1';
  const resource = page === 'despesas' ? 'expenses' : 'revenues';
  const [records, , refreshRecords] = useStoredArray(resourceKey, []);
  const clientsStore = useWorkspaceRecords('clients');
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [clientId, setClientId] = useState('');
  const [category, setCategory] = useState('');
  const [entryDate, setEntryDate] = useState(localDateInput());
  const [dueDate, setDueDate] = useState('');
  const [recurrenceFrequency, setRecurrenceFrequency] = useState('none');
  const [recurrenceCount, setRecurrenceCount] = useState(12);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState('');
  const [editingRecord, setEditingRecord] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [periodFilter, setPeriodFilter] = useState('Todos');
  const [clientFilter, setClientFilter] = useState('Todos');
  const [saveError, setSaveError] = useState('');
  useEffect(() => {
    if (!navigationContext?.intentId || !['create', 'list'].includes(navigationContext.action)) return;
    setClientId(String(navigationContext.clientId || ''));
    setClientFilter(navigationContext.action === 'list' ? String(navigationContext.clientId || '') : 'Todos');
    setCounterparty(navigationContext.clientName || '');
    if (navigationContext.action === 'create') setFormOpen(true);
    onNavigationContextConsumed();
  }, [navigationContext?.intentId, onNavigationContextConsumed]);
  const verb = page === 'despesas' ? 'Nova despesa' : 'Nova receita';
  const startEditing = (key) => {
    const target = records.find((item) => String(financeRecordActionKey(item)) === String(key));
    if (!target) return;
    setEditingRecord(target); setName(target.description || ''); setAmount(String(target.amount ?? ''));
    setCounterparty(target.counterparty || ''); setClientId(String(target.clientId || target.workspaceClientId || target.clientRecordId || '')); setCategory(target.category || '');
    setEntryDate(String(target.date || localDateInput()).slice(0, 10)); setDueDate(String(target.dueDate || '').slice(0, 10)); setRecurrenceFrequency('none');
    setSaveError(''); setFormOpen(true);
  };
  const closeForm = () => { if (saving) return; setEditingRecord(null); setName(''); setAmount(''); setCounterparty(''); setClientId(''); setCategory(''); setEntryDate(localDateInput()); setDueDate(''); setRecurrenceFrequency('none'); setRecurrenceCount(12); setFormOpen(false); setSaveError(''); };
  const amountNumber = (item) => Number(item.amount) || 0;
  const exportFinanceCsv = () => {
    downloadCsvFile(`${page}-${localDateInput()}.csv`, financeRecordsCsv(visibleFinanceRecords, page));
  };
  const selectedClient = clientsStore.records.find((client) => String(client.id) === String(clientId));
  const visibleFinanceRecords = filterFinanceRecords(records, { category: categoryFilter, period: periodFilter, clientId: clientFilter });
  const recurrenceLabels = { weekly: 'semanal', monthly: 'mensal', quarterly: 'trimestral', yearly: 'anual' };
  const moneyRows = visibleFinanceRecords.map((item) => Object.assign([item.code || item.id, [clientsStore.records.find((client) => String(client.id) === String(item.clientId || item.workspaceClientId || item.clientRecordId))?.name, item.counterparty, item.category, item.description, item.recurrenceSeriesId ? `Recorrência ${recurrenceLabels[item.recurrenceFrequency] || ''} · ${item.recurrenceSequence}/${item.recurrenceCount}` : ''].filter(Boolean).join(' / '), item.date ? new Date(`${String(item.date).slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR') + (item.dueDate ? ` / vence ${new Date(`${String(item.dueDate).slice(0,10)}T12:00:00`).toLocaleDateString('pt-BR')}` : '') : '', money(amountNumber(item)), isFinanceRecordOverdue(item) ? 'Atrasada' : item.status || 'Pendente'], { recordId: financeRecordActionKey(item) }));

  const submit = async (event) => {
    event.preventDefault();
    if (saving || actionId) return;
    const value = Number(amount.replace(',', '.'));
    if (!name.trim() || !Number.isFinite(value) || value <= 0) { notify('Preencha a descrição e um valor válido.'); return; }
    const clientLink = resolveFinanceClientLink(clientId, clientsStore.records, clientsStore.loading, counterparty);
    if (clientLink.error) { setSaveError(clientLink.error); return; }
    const record = { ...(editingRecord || {}), code: editingRecord?.code || `${page.slice(0, 3).toUpperCase()}-${String(Date.now()).slice(-5)}`, description: name.trim(), counterparty: clientLink.counterparty || selectedClient?.name || '', clientId: clientLink.clientId, category: category.trim() || 'Manual', date: entryDate, dueDate: dueDate || null, amount: value, status: editingRecord?.status || 'Pendente' };
    setSaving(true); setSaveError('');
    try {
      if (editingRecord) {
        const cleanRecord = Object.fromEntries(Object.entries(record).filter(([field]) => !['id', 'createdAt', 'updatedAt'].includes(field)));
        await apiRequest(`/api/workspace/${resource}/${editingRecord.id}`, { method: 'PATCH', body: JSON.stringify({ data: cleanRecord }) });
      }
      else if (recurrenceFrequency !== 'none') {
        await apiRequest(`/api/workspace/${resource}/recurring`, { method: 'POST', body: JSON.stringify({ seriesId: crypto.randomUUID(), frequency: recurrenceFrequency, count: Number(recurrenceCount), data: record }) });
      }
      else await apiRequest(`/api/workspace/${resource}`, { method: 'POST', body: JSON.stringify({ data: record }) });
      setEditingRecord(null); setName(''); setAmount(''); setCounterparty(''); setClientId(''); setCategory(''); setEntryDate(localDateInput()); setDueDate(''); setRecurrenceFrequency('none'); setRecurrenceCount(12); setFormOpen(false);
      try { await refreshRecords(); notify(editingRecord ? 'Lan\u00e7amento atualizado no workspace.' : recurrenceFrequency !== 'none' ? `Série criada com ${recurrenceCount} lançamentos no workspace.` : `${verb} gravada no workspace.`); }
      catch (error) { setSaveError(`${editingRecord ? 'O lan\u00e7amento foi atualizado' : `${verb} foi gravada`}, mas a lista n\u00e3o atualizou. Recarregue os registros. ${error.message || ''}`); }
    } catch (error) {
      setSaveError(error.message || `Não foi possível gravar ${verb.toLocaleLowerCase('pt-BR')}.`);
    } finally { setSaving(false); }
  };

  const doAction = async (key) => {
    if (saving || actionId) return;
    const target = records.find((item) => String(financeRecordActionKey(item)) === String(key));
    if (!target) return notify('Este lançamento não está mais disponível. Atualize a lista.');
    const action = financeEntryActionForStatus(target.status);
    if (action === 'unsupported') {
      setSaveError(`O status "${target.status || 'vazio'}" não permite baixa ou exclusão automática. O lançamento foi mantido; edite o status para continuar.`);
      return;
    }
    const settling = action === 'settle';
    const confirmation = `${settling ? 'Registrar baixa manual de' : 'Remover'} ${target.description} (${money(amountNumber(target))})?`;
    if (settling ? !window.confirm(confirmation) : !confirmWorkspaceDelete(confirmation, preferences)) return;
    setActionId(String(target.id)); setSaveError('');
    let mutationConfirmed = false;
    try {
      if (settling) await apiRequest(`/api/workspace/${resource}/${target.id}`, { method: 'PATCH', body: JSON.stringify({ data: { status: page === 'despesas' ? 'Paga' : 'Recebida', settledAt: new Date().toISOString() } }) });
      else await apiRequest(`/api/workspace/${resource}/${target.id}`, { method: 'DELETE' });
      mutationConfirmed = true;
      await refreshRecords();
      notify(settling ? 'Baixa manual registrada no workspace.' : 'Lançamento removido do workspace.');
    } catch (error) {
      setSaveError(mutationConfirmed ? `A API confirmou a alteração, mas a lista não atualizou. Recarregue os registros. ${error.message || ''}` : error.message || 'Não foi possível confirmar a alteração na API.');
    } finally { setActionId(''); }
  };
  const total = records.reduce((sum, item) => sum + amountNumber(item), 0);
  const delayed = records.filter((item) => isFinanceRecordOverdue(item) || ['Atrasada', 'Vencida'].includes(item.status));
  const pending = records.filter((item) => item.status === 'Pendente' && !isFinanceRecordOverdue(item));
  return <>
    <div className="ns-metrics ns-metrics-three">
      <Metric label={page === 'despesas' ? 'Despesas registradas' : 'Receitas registradas'} value={money(total)} note={`${records.length} lançamentos no workspace`} icon={page === 'despesas' ? ArrowUpRight : ArrowDownLeft} />
      <Metric label="Aguardando" value={money(pending.reduce((sum, item) => sum + amountNumber(item), 0))} note={`${pending.length} lançamentos pendentes`} icon={Clock3} />
      <Metric label="Em atraso" value={money(delayed.reduce((sum, item) => sum + amountNumber(item), 0))} note={`${delayed.length} precisam de atenção`} icon={AlertCircle} />
    </div>
    {saveError && <div className="dashboard-data-error" role="alert">{saveError}<button type="button" onClick={() => setSaveError('')}>Fechar</button></div>}
    {formOpen && <form className="ns-inline-form" aria-busy={saving} onSubmit={submit}>
      <div><b>{editingRecord ? 'Editar lan\u00e7amento' : verb}</b><small>O registro ser&aacute; gravado na conta do workspace.</small></div>
      <input aria-label="Descrição" required disabled={saving || Boolean(actionId)} placeholder="Descrição do lançamento" value={name} onChange={(event) => setName(event.target.value)} />
      <input aria-label={page === 'despesas' ? 'Fornecedor' : 'Cliente'} disabled={saving || Boolean(actionId)} placeholder={page === 'despesas' ? 'Fornecedor' : 'Cliente'} value={counterparty} onChange={(event) => setCounterparty(event.target.value)} />
      <select aria-label="Cliente vinculado" disabled={saving || Boolean(actionId) || clientsStore.loading} value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Sem vínculo com cliente</option>{clientsStore.records.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
      <input aria-label="Categoria" disabled={saving || Boolean(actionId)} placeholder="Categoria" value={category} onChange={(event) => setCategory(event.target.value)} />
      <input aria-label="Data" required disabled={saving || Boolean(actionId)} type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
      <input aria-label="Vencimento" disabled={saving || Boolean(actionId)} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
      <input aria-label="Valor" required disabled={saving || Boolean(actionId)} type="number" min="0.01" step="0.01" placeholder="Valor" value={amount} onChange={(event) => setAmount(event.target.value)} />
      {!editingRecord && <fieldset className="ns-recurrence-fields" disabled={saving || Boolean(actionId)}><legend>Repetição</legend><label>Frequência<select aria-label="Frequência da recorrência" value={recurrenceFrequency} onChange={(event) => setRecurrenceFrequency(event.target.value)}><option value="none">Não repetir</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option><option value="quarterly">Trimestral</option><option value="yearly">Anual</option></select></label>{recurrenceFrequency !== 'none' && <><label>Número de lançamentos<input aria-label="Número de lançamentos" required type="number" min="2" max="60" step="1" value={recurrenceCount} onChange={(event) => setRecurrenceCount(event.target.value)} /></label><small>Serão criados {recurrenceCount} registros pendentes, incluindo este. Datas e vencimentos avançam conforme a frequência.</small></>}</fieldset>}
      {editingRecord?.recurrenceSeriesId && <p className="ns-recurrence-note">Este é o lançamento {editingRecord.recurrenceSequence} de {editingRecord.recurrenceCount} da série. Editar ou remover afeta somente este registro.</p>}
      <button className="ns-primary" type="submit" disabled={saving || Boolean(actionId)}><Check size={15} />{saving ? 'Salvando...' : editingRecord ? 'Salvar altera\u00e7\u00f5es' : 'Salvar'}</button>
      <IconButton label="Fechar formul&aacute;rio" onClick={closeForm}><X size={16} /></IconButton>
    </form>}
    <div className="ns-finance-filters"><label>Categoria<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option>Todos</option>{[...new Set(records.map((item) => item.category || 'Sem categoria'))].sort((a, b) => a.localeCompare(b, 'pt-BR')).map((categoryName) => <option key={categoryName}>{categoryName}</option>)}</select></label><label>Período<select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)}>{['Todos', 'Este mês', 'Mês passado', 'Este ano'].map((period) => <option key={period}>{period}</option>)}</select></label><label>Cliente<select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option>Todos</option><option value="">Sem vínculo</option>{clientsStore.records.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><span>{visibleFinanceRecords.length} de {records.length} lançamentos</span><button className="ns-secondary" type="button" disabled={!visibleFinanceRecords.length} onClick={exportFinanceCsv}><Download size={14} />Exportar CSV</button></div>
    <div aria-busy={Boolean(actionId)}><DataTable columns={titles[page]} rows={moneyRows} search onAction={doAction} onEdit={startEditing} /></div>
    <div className="ns-page-bottom"><span><ShieldCheck size={15} /> Lançamentos vinculados ao workspace; cliente pode ser associado para abrir o financeiro pela ficha.</span><button className="ns-secondary" type="button" disabled={saving || Boolean(actionId)} onClick={() => { if (formOpen) closeForm(); else { setEditingRecord(null); setName(''); setAmount(''); setCounterparty(''); setClientId(''); setCategory(''); setEntryDate(localDateInput()); setDueDate(''); setSaveError(''); setFormOpen(true); } }}><Plus size={15} />{verb}</button></div>
  </>;
}
function Inbox({ notify, forceWhatsapp = false, navigationContext = null, onNavigationContextConsumed = () => {} }) {
  const localDemo = isLocalDemoActive();
  const [messages, , refreshMessages, messagesLoading] = useStoredArray('nexo.support.conversations.v1', initialMessages);
  const clientsStore = useWorkspaceRecords('clients');
  const contactsStore = useWorkspaceRecords('contacts');
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState('');
  const [filter, setFilter] = useState('Todas');
  const [query, setQuery] = useState('');
  const [channel, setChannel] = useState('WhatsApp');
  const [newOpen, setNewOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', company: '', phone: '', email: '' });
  const [attachment, setAttachment] = useState(null);
  const [owner, setOwner] = useState('');
  const [sessions, setSessions] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [emailThreads, setEmailThreads] = useState([]);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailLoaded, setEmailLoaded] = useState(false);
  const [emailError, setEmailError] = useState(null);
  const [emailProvider, setEmailProvider] = useState('google');
  const [emailProviders, setEmailProviders] = useState([]);
  const emailLoadRequests = useRef(null);
  if (!emailLoadRequests.current) emailLoadRequests.current = createLatestRequestGuard();
  const handledInboxNavigation = useRef('');
  const inboxRole = (() => { try { return JSON.parse(sessionStorage.getItem('nexo.api.user') || 'null')?.role || ''; } catch { return ''; } })();
  const canAuthorizeInboxGoogle = canAuthorizeOAuthIntegrations(inboxRole);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [retrySessions, setRetrySessions] = useState(0);
  const [sending, setSending] = useState(false);
  const [taskCreating, setTaskCreating] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskDue, setTaskDue] = useState(nextInboxFollowUpDate);
  const [taskError, setTaskError] = useState('');
  const [conversationError, setConversationError] = useState('');
  const whatsappMessages = messages.filter((item) => item.channel !== 'Gmail' && item.gmailMetadata !== true);
  const activeMessages = channel === 'E-mail' ? emailThreads : whatsappMessages;
  const current = activeMessages.find((item) => String(item.id) === String(selectedId)) || activeMessages[0];
  const canReply = canReplyToInboxConversation(channel, current);
  const linkedClient = current ? matchConversationClient(clientsStore.records, contactsStore.records, current) : null;
  const openClientRecord = () => {
    if (!current) return;
    const context = linkedClient
      ? { clientId: linkedClient.id, intentId: globalThis.crypto?.randomUUID?.() || `client-${Date.now()}` }
      : { search: current.email || current.phone || current.name || '' };
    window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: { page: 'Clientes', context } }));
  };
  const activeSessions = sessions.filter((session) => session.status === 'WORKING');
  const effectiveSessionId = selectedSessionId || current?.whatsappSessionId || activeSessions[0]?.id || '';
  useEffect(() => {
    setSelectedSessionId(preferredInboxSessionId(current?.whatsappSessionId, activeSessions));
  }, [current?.id, current?.whatsappSessionId, activeSessions.map((session) => session.id).join('|')]);
  const loadGmail = useCallback(async () => {
    if (document.visibilityState === 'hidden') return;
    const requestId = emailLoadRequests.current.begin();
    setEmailLoading(true); setEmailLoaded(false); setEmailError(null);
    try {
      const status = await apiRequest('/api/integrations/status');
      if (!emailLoadRequests.current.isCurrent(requestId)) return;
      const ready = availableInboxEmailProviders(status.data);
      setEmailProviders(ready);
      const provider = ready.some((item) => item.name === (emailProvider === 'hostinger' ? 'Hostinger E-mail' : 'Google Workspace')) ? emailProvider : ready.some((item) => item.name === 'Google Workspace') ? 'google' : 'hostinger';
      if (provider !== emailProvider) setEmailProvider(provider);
      if (!ready.length) { setEmailThreads([]); setEmailError({ code: 'integration_not_configured', message: 'Conecte Gmail ou Hostinger em Integra\u00e7\u00f5es para usar a caixa de entrada.' }); return; }
      const result = await apiRequest(provider === 'hostinger' ? '/api/integrations/hostinger/inbox' : '/api/integrations/google/gmail');
      if (!emailLoadRequests.current.isCurrent(requestId)) return;
      const metadata = await fetchAllRecords('/api/workspace/inbox').catch(() => []);
      if (!emailLoadRequests.current.isCurrent(requestId)) return;
      setEmailThreads(provider === 'hostinger'
        ? mergeHostingerThreadMetadata(result.data || [], metadata)
        : mergeGmailThreadMetadata(result.data || [], metadata));
    }
    catch (error) { if (emailLoadRequests.current.isCurrent(requestId)) setEmailError({ code: error.code || '', message: error.message || 'N\u00e3o foi poss\u00edvel carregar a caixa de e-mail.' }); }
    finally { if (emailLoadRequests.current.isCurrent(requestId)) { setEmailLoading(false); setEmailLoaded(true); } }
  }, [emailProvider]);
  const selectConversation = async (item) => {
    setSelectedId(String(item.id));
    setOwner(item.owner || '');
    if (channel === 'E-mail' && item.unread) {
      const readUrl = item.provider === 'hostinger' ? `/api/integrations/hostinger/${encodeURIComponent(String(item.id).replace(/^hostinger:/, ''))}/read` : `/api/integrations/google/gmail/${encodeURIComponent(item.threadId || item.id)}/read`;
      apiRequest(readUrl, { method: 'POST', body: JSON.stringify({}) }).then(loadGmail).catch((error) => setEmailError({ code: error.code || '', message: error.message || 'N\u00e3o foi poss\u00edvel marcar este e-mail como lido.' }));
    }
    if (channel === 'WhatsApp' && Number(item.unread || 0) > 0) {
      try {
        const result = await markInboxConversationRead(item, {
          update: (data) => apiRequest(`/api/workspace/inbox/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify({ data }) }),
          refresh: refreshMessages,
        });
        if (!result.refreshed) notify('Conversa marcada como lida, mas a lista não atualizou. Recarregue para conferir.');
      } catch (error) {
        await refreshMessages().catch(() => {});
        notify(error.message || 'Não foi possível marcar esta conversa como lida.');
      }
    }
  };
  useEffect(() => {
    let mounted = true;
    const loadSessions = async () => {
      try {
        const integrations = await apiRequest('/api/integrations/status');
        const waha = (integrations.data || []).find((item) => item.name === 'WAHA' || item.provider === 'waha');
         if (!waha?.configured || !waha.enabled) { if (mounted) { setSessions([]); setSessionError(''); } return; }
         const result = await apiRequest('/api/integrations/waha/sessions');
         if (!mounted) return;
         setSessionError('');
        const rows = result.data || [];
        setSessions(rows);
        setSelectedSessionId((currentId) => rows.some((row) => row.id === currentId && row.status === 'WORKING') ? currentId : rows.find((row) => row.status === 'WORKING')?.id || '');
      } catch (error) { if (mounted) { setSessions([]); setSessionError(error.message || 'Não foi possível consultar as sessões WhatsApp.'); } }
    };
    apiRequest('/api/workspace/assignees').then((result) => { if (mounted) setTeamMembers(result.data || []); }).catch(() => { if (mounted) setTeamMembers([]); });
    loadSessions();
    const sessionsTimer = window.setInterval(loadSessions, 30000);
    const messagesTimer = window.setInterval(() => refreshMessages().catch(() => {}), 5000);
    return () => { mounted = false; window.clearInterval(sessionsTimer); window.clearInterval(messagesTimer); };
  }, [refreshMessages, retrySessions]);
  useEffect(() => {
    if (!selectedId && activeMessages[0]?.id) setSelectedId(String(activeMessages[0].id));
    else if (selectedId && !activeMessages.some((item) => String(item.id) === String(selectedId))) setSelectedId(String(activeMessages[0]?.id || ''));
  }, [activeMessages, selectedId]);
  useEffect(() => { setOwner(current?.owner || ''); }, [current?.id, current?.owner]);
  const inboxNavigationKey = navigationContext?.intentId
    || (navigationContext?.conversationId ? `${navigationContext.channel || ''}:${navigationContext.conversationId}` : navigationContext?.clientId ? `client:${navigationContext.clientId}` : '');
  useEffect(() => {
    if (!navigationContext || !inboxNavigationKey) {
      handledInboxNavigation.current = '';
      return;
    }
    if (handledInboxNavigation.current === inboxNavigationKey) return;
    const targetChannel = normalizeInboxChannel(navigationContext.channel) || (navigationContext.clientId ? 'WhatsApp' : '');
    if (targetChannel && channel !== targetChannel) {
      setChannel(targetChannel);
      setFilter('Todas');
      if (targetChannel === 'E-mail') setEmailLoaded(false);
      return;
    }
    if (navigationContext.conversationId) {
      const channelLoading = targetChannel === 'E-mail' ? emailLoading || !emailLoaded : messagesLoading;
      if (channelLoading) return;
      const resolution = resolveInboxConversationNavigation(
        navigationContext,
        targetChannel === 'E-mail' ? emailThreads : whatsappMessages,
        channel,
        false,
      );
      if (resolution.status === 'pending') return;
      if (resolution.status === 'found') {
        setQuery('');
        setFilter('Todas');
        setSelectedId(String(resolution.conversation.id));
      } else if (resolution.status === 'not_found') {
        notify('Não encontrei essa conversa no canal solicitado. Atualize a caixa de entrada e tente novamente.');
      }
      handledInboxNavigation.current = inboxNavigationKey;
      onNavigationContextConsumed();
      return;
    }
    if (!navigationContext.clientId || messagesLoading || clientsStore.loading || contactsStore.loading) return;
    const client = clientsStore.records.find((item) => String(item.id) === String(navigationContext.clientId));
    if (!client) {
      notify('N\u00e3o encontrei este cliente para abrir o atendimento.');
      handledInboxNavigation.current = inboxNavigationKey;
      onNavigationContextConsumed();
      return;
    }
    const conversation = whatsappMessages.find((item) => String(matchConversationClient(clientsStore.records, contactsStore.records, item)?.id) === String(client.id));
    setChannel('WhatsApp');
    setFilter('Todas');
    if (conversation) {
      setQuery('');
      setSelectedId(String(conversation.id));
    } else {
      setSelectedId('');
      setNewContact({ name: client.person || client.name, company: client.name, phone: client.phone || '', email: client.email || '' });
      setNewOpen(true);
      notify('N\u00e3o existe conversa para este cliente. Revise os dados e crie o atendimento quando estiver pronto.');
    }
    handledInboxNavigation.current = inboxNavigationKey;
    onNavigationContextConsumed();
  }, [navigationContext, inboxNavigationKey, channel, emailLoading, emailLoaded, emailThreads, messagesLoading, clientsStore.loading, clientsStore.records, contactsStore.loading, contactsStore.records, whatsappMessages, onNavigationContextConsumed, notify]);
  useEffect(() => {
    if (channel !== 'E-mail') {
      emailLoadRequests.current.invalidate();
      setEmailLoading(false);
      setEmailLoaded(false);
      return undefined;
    }
    loadGmail();
    return () => emailLoadRequests.current.invalidate();
  }, [channel, loadGmail]);
  useEffect(() => {
    if (channel !== 'E-mail') return undefined;
    const timer = window.setInterval(loadGmail, 30000);
    return () => window.clearInterval(timer);
  }, [channel, loadGmail]);
  const send = async (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!canReply) { notify('Este atendimento está resolvido. Reabra o atendimento antes de responder.'); return; }
    if ((!text && (channel === 'E-mail' || !attachment)) || !current || sending) return;
    if (channel === 'E-mail') {
      const recipient = current.email || current.name?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
      if (!recipient) { notify('Esta conversa não tem endereço de e-mail.'); return; }
      setSending(true);
      try {
        const last = current.history?.at(-1);
        const attachments = attachment ? [{ filename: attachment.name, mimeType: attachment.type || 'application/octet-stream', contentBase64: await encodeAttachmentFile(attachment) }] : [];
        const provider = current.provider === 'hostinger' || emailProvider === 'hostinger' ? 'hostinger' : 'google';
        const payload = { to: recipient, subject: /^re:/i.test(current.subject || '') ? current.subject : `Re: ${current.subject || '(sem assunto)'}`, text, inReplyTo: last?.messageId, references: last?.references, attachments };
        const result = await sendInboxMessage({
          deliver: () => provider === 'hostinger'
            ? apiRequest('/api/integrations/hostinger/send', { method: 'POST', body: JSON.stringify(payload) })
            : apiRequest(`/api/integrations/google/gmail/${encodeURIComponent(current.threadId || current.id)}/reply`, { method: 'POST', body: JSON.stringify(payload) }),
          onSent: () => { setDraft(''); setAttachment(null); },
          refresh: loadGmail,
        });
        notify(result.refreshed ? `Resposta enviada por ${provider === 'hostinger' ? 'Hostinger' : 'Gmail'}.` : `Resposta enviada por ${provider === 'hostinger' ? 'Hostinger' : 'Gmail'}, mas a caixa não atualizou. Atualize para conferir.`);
      } catch (error) { notify(error.message || 'Não foi possível responder o e-mail.'); }
      finally { setSending(false); }
      return;
    }
    const sessionId = selectedSessionId || current.whatsappSessionId || activeSessions[0]?.id;
    const chatId = current.whatsappChatId || normalizeWhatsAppChatId(current.phone);
    if (!sessionId || !chatId) { notify(!sessionId ? 'Conecte uma sessão WAHA ativa em Integrações.' : 'Esta conversa não tem telefone válido para WhatsApp.'); return; }
    setSending(true);
    try {
      const file = attachment ? { attachment: { filename: attachment.name, mimeType: attachment.type || 'application/octet-stream', contentBase64: await encodeAttachmentFile(attachment) } } : {};
      const result = await sendInboxMessage({
        deliver: () => apiRequest('/api/integrations/waha/send', { method: 'POST', body: JSON.stringify({ sessionId, conversationId: current.id, clientMessageId: globalThis.crypto.randomUUID(), chatId, text, ...file }) }),
        onSent: () => { setDraft(''); setAttachment(null); },
        refresh: refreshMessages,
      });
      const deliveryMessage = result.simulated
        ? (attachment ? 'Anexo simulado localmente; nada foi enviado ao WhatsApp.' : 'Mensagem simulada localmente; nada foi enviado ao WhatsApp.')
        : attachment ? 'Arquivo enviado pelo WhatsApp.' : 'Mensagem enviada pelo WhatsApp.';
      notify(result.refreshed ? deliveryMessage : `${deliveryMessage} A conversa não atualizou. Atualize para conferir.`);
    } catch (error) { notify(error.message || 'Não foi possível enviar a mensagem pelo WhatsApp.'); }
    finally { setSending(false); }
  };
  const createConversation = async (event) => {
    event.preventDefault();
    if (sending) return;
    if (channel === 'E-mail') {
      if (!newContact.email.trim() || !newContact.subject?.trim() || !newContact.body?.trim()) {
        setConversationError('Preencha destinatário, assunto e mensagem antes de enviar.');
        return;
      }
      if (emailLoading || !emailProviders.length) {
        setConversationError('Conecte uma conta Google Workspace ou Hostinger em Integrações para enviar e-mails.');
        return;
      }
      setSending(true);
      setConversationError('');
      try {
        const attachments = attachment ? [{ filename: attachment.name, mimeType: attachment.type || 'application/octet-stream', contentBase64: await encodeAttachmentFile(attachment) }] : [];
        const payload = { to: newContact.email.trim(), subject: newContact.subject.trim(), text: newContact.body.trim(), attachments };
        if (emailProvider === 'hostinger') await apiRequest('/api/integrations/hostinger/send', { method: 'POST', body: JSON.stringify(payload) });
        else await apiRequest('/api/integrations/google/gmail/send', { method: 'POST', body: JSON.stringify(payload) });
        await loadGmail();
        setAttachment(null);
        setNewOpen(false);
        setNewContact({ name: '', company: '', phone: '', email: '', subject: '', body: '' });
        notify(`E-mail enviado por ${emailProvider === 'hostinger' ? 'Hostinger' : 'Gmail'}.`);
      } catch (error) {
        setConversationError(error.message || 'Não foi possível enviar o e-mail. Revise a conexão e tente novamente.');
      } finally { setSending(false); }
      return;
    }
    if (!newContact.name.trim() || !newContact.company.trim() || !newContact.phone.trim()) {
      setConversationError('Informe nome, empresa ou cliente e telefone para criar o atendimento.');
      return;
    }
    const whatsappChatId = normalizeWhatsAppChatId(newContact.phone);
    if (!whatsappChatId) {
      setConversationError('Informe um telefone válido com DDD e país quando necessário.');
      return;
    }
    const assignee = teamMembers.find((member) => member.name === owner);
    const item = { id: globalThis.crypto?.randomUUID?.() || `conversation-${Date.now()}`, ...newContact, status: 'open', assigneeId: assignee?.id || '', initials: newContact.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), time: new Date().toISOString(), text: '', unread: 0, color: 'blue', channel: 'WhatsApp', owner, whatsappSessionId: selectedSessionId || activeSessions[0]?.id || '', whatsappChatId, history: [] };
    setSending(true);
    setConversationError('');
    try {
      const saved = await apiRequest('/api/workspace/inbox', { method: 'POST', body: JSON.stringify({ data: Object.fromEntries(Object.entries(item).filter(([field]) => !['id', 'createdAt', 'updatedAt'].includes(field))) }) });
      await refreshMessages();
      setSelectedId(String(saved.data.id));
      setNewOpen(false);
      setNewContact({ name: '', company: '', phone: '', email: '' });
      notify('Conversa criada. Selecione uma sessão WAHA ativa para enviar mensagens.');
    } catch (error) {
      setConversationError(error.message || 'Não foi possível criar a conversa. Seus dados continuam no formulário.');
    } finally { setSending(false); }
  };
  const updateConversationMetadata = async (patch) => {
    if (!current) throw new Error('Selecione uma conversa primeiro.');
    if (channel === 'E-mail') {
      const isHostinger = current.provider === 'hostinger';
      const row = isHostinger ? hostingerThreadMetadataRecord(current, patch, current) : gmailThreadMetadataRecord(current, patch, current);
      const saved = current.emailMetadataId
        ? await apiRequest(`/api/workspace/inbox/${encodeURIComponent(current.emailMetadataId)}`, { method: 'PATCH', body: JSON.stringify({ data: row }) })
        : await apiRequest('/api/workspace/inbox', { method: 'POST', body: JSON.stringify({ data: row }) });
      setEmailThreads((rows) => rows.map((thread) => String(thread.id) === String(current.id) ? { ...thread, ...patch, emailMetadataId: saved.data.id } : thread));
      return;
    }
    const data = Object.fromEntries(Object.entries({ ...current, ...patch }).filter(([field]) => !['id', 'createdAt', 'updatedAt'].includes(field)));
    await apiRequest(`/api/workspace/inbox/${encodeURIComponent(current.id)}`, { method: 'PATCH', body: JSON.stringify({ data }) });
    await refreshMessages();
  };
  const assignConversation = async (assigneeId) => {
    const assignee = teamMembers.find((member) => String(member.id) === String(assigneeId));
    try {
      await updateConversationMetadata({ assigneeId: assignee?.id || '', owner: assignee?.name || '' });
      setOwner(assignee?.name || '');
      notify(assignee ? `Conversa atribuida a ${assignee.name}.` : 'Responsavel removido da conversa.');
    } catch (error) { notify(error.message || 'Nao foi possivel atribuir esta conversa.'); }
  };
  const setConversationStatus = async (status) => {
    try {
      await updateConversationMetadata({ status });
      notify(status === 'closed' ? 'Atendimento resolvido.' : 'Atendimento reaberto.');
    } catch (error) { notify(error.message || 'Nao foi possivel atualizar o atendimento.'); }
  };
  const shown = filterInboxConversations(activeMessages, query, filter);
  const exportInbox = () => {
    const channelLabel = channel === 'E-mail' ? 'E-mail' : 'WhatsApp';
    const data = [['Canal', 'Contato', 'Cliente / empresa', 'Telefone', 'E-mail', 'Responsável', 'Status', 'Última atividade', 'Prévia da última mensagem'], ...shown.map((item) => [channelLabel, item.name || '', item.company || '', item.phone || '', item.email || '', item.owner || item.assignee || '', item.status || '', item.time || item.updatedAt || '', String(item.text || '').slice(0, 240)])];
    downloadCsvFile(`caixa-de-entrada-${channel === 'E-mail' ? 'email' : 'whatsapp'}-${localDateInput()}.csv`, rowsToCsv(data));
    notify(`${shown.length} conversa${shown.length === 1 ? '' : 's'} exportada${shown.length === 1 ? '' : 's'} da visualização atual.`);
  };
  const history = current?.history?.length ? current.history : (current?.text ? [{ side: 'received', text: current.text, time: current.time || '' }] : []);
  const createTask = async (event) => { event.preventDefault(); if (!current || taskCreating || !taskDue) return; setTaskCreating(true); setTaskError(''); try { await apiRequest('/api/workspace/tasks', { method: 'POST', body: JSON.stringify({ data: buildInboxFollowUpTask(current, { client: linkedClient, assignee: owner, due: taskDue }) }) }); setTaskOpen(false); notify('Retorno agendado e vinculado ao atendimento.'); } catch (error) { setTaskError(error.message || 'Nao foi possivel criar a tarefa. Seus dados continuam no formulario.'); } finally { setTaskCreating(false); } };
  const callContact = () => {
    const number = String(current?.phone || '').trim().replace(/[^\d+]/g, '');
    if (!number) { notify('Este contato não tem telefone cadastrado.'); return; }
    window.location.assign(`tel:${number}`);
  };
  const copyContact = async () => {
    const details = [current?.name, current?.phone, current?.email].filter(Boolean).join('\n');
    if (!details) { notify('Não há dados de contato para copiar.'); return; }
    try { await navigator.clipboard.writeText(details); notify('Dados do contato copiados.'); }
    catch { notify('A cópia foi bloqueada pelo navegador. Use os dados no painel do contato.'); }
  };
  return <div className="ns-inbox-layout"><aside className="ns-inbox-list"><div className="ns-inbox-top"><div className="ns-channel-switch"><button type="button" aria-label="Abrir conversas do WhatsApp" title="WhatsApp" className={channel === 'WhatsApp' ? 'active' : ''} onClick={() => { setChannel('WhatsApp'); setFilter('Todas'); }}><MessageCircle size={15} /><span className="ns-channel-label ns-channel-whatsapp-label">WhatsApp</span><span>{whatsappMessages.length}</span></button><button type="button" aria-label="Abrir caixa de e-mail" title="E-mail" className={channel === 'E-mail' ? 'active' : ''} onClick={() => { setChannel('E-mail'); setFilter('Todas'); }}><Mail size={15} /><span className="ns-channel-label">E-mail</span></button></div><IconButton label="Exportar conversas visíveis em CSV" disabled={!shown.length} onClick={exportInbox}><Download size={16} /></IconButton><IconButton label="Nova conversa" onClick={() => { setConversationError(''); setAttachment(null); setNewOpen(true); }}><Plus size={17} /></IconButton></div><label className="ns-search ns-inbox-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conversa" /></label><div className="ns-filter-tabs compact">{['Todas', 'Nao lidas', 'Abertas', 'Resolvidas'].map((item) => <button type="button" key={item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><div className="ns-conversation-list">{emailError && channel === 'E-mail' && <div className="dashboard-data-error" role="alert"><span>{emailError.message}</span>{googleEmailErrorAction(emailError.code) === 'reauthorize' && canAuthorizeInboxGoogle && <button type="button" onClick={() => window.location.assign('/api/integrations/google/authorize')}>Reautorizar Google</button>}{googleEmailErrorAction(emailError.code) === 'reauthorize' && !canAuthorizeInboxGoogle && <span>Pe&#231;a &agrave; pessoa propriet&#225;ria do workspace para reautorizar o Google.</span>}{googleEmailErrorAction(emailError.code) === 'configure' && <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Integra\u00e7\u00f5es' }))}>Abrir integra&#231;&#245;es</button>}<button type="button" onClick={loadGmail}>Tentar novamente</button></div>}{emailLoading && channel === 'E-mail' && emailThreads.length === 0 && <p className="ns-empty-history">Carregando e-mails...</p>}{shown.map((item) => <button type="button" onClick={() => selectConversation(item)} className={`ns-conversation ${String(current?.id) === String(item.id) ? 'active' : ''}`} key={item.id}><span className={`ns-avatar ${item.color || 'blue'}`}>{item.initials || item.name?.slice(0, 1)}</span><span className="ns-conversation-copy"><span><b>{item.name}</b><small>{item.time}</small></span><small>{item.company}</small><span className="ns-preview">{item.text}</span></span>{item.unread > 0 && <i className="ns-unread">{item.unread}</i>}</button>)}{shown.length === 0 && !(channel === 'E-mail' && emailLoading) && <p className="ns-empty-history">{query || filter !== 'Todas' ? 'Nenhuma conversa corresponde ? busca ou filtro.' : channel === 'E-mail' && !emailProviders.length ? 'Conecte uma conta de e-mail para carregar conversas.' : 'Nenhuma conversa encontrada.'}</p>}</div></aside><section className="ns-chat"><header className="ns-chat-header"><div className="ns-chat-person"><span className={`ns-avatar ${current?.color || 'blue'}`}>{current?.initials || current?.name?.slice(0, 1)}</span><span><b>{current?.name || 'Selecione uma conversa'}</b><small>{current?.company || ''} · {channel}</small></span></div><div className="ns-chat-actions"><IconButton label={current?.phone ? `Ligar para ${current.name}` : 'Telefone não informado'} disabled={!current?.phone} onClick={callContact}><Smartphone size={16} /></IconButton><IconButton label="Copiar contato" disabled={!current || (!current.phone && !current.email)} onClick={copyContact}><Copy size={16} /></IconButton></div></header><div className="ns-chat-context"><span className={`ns-online-dot ${channel === 'WhatsApp' && effectiveSessionId ? '' : 'offline'}`} />{channel === 'E-mail' ? <select aria-label='Conta de e-mail' value={emailProvider} onChange={(event) => setEmailProvider(event.target.value)}>{emailProviders.map((provider) => <option key={provider.name} value={provider.name === 'Hostinger E-mail' ? 'hostinger' : 'google'}>{provider.name} · {provider.accountEmail}</option>)}</select> : activeSessions.length ? <><span>{localDemo ? 'Sessão simulada' : 'Sessão WhatsApp'}</span><select aria-label="Sessão WhatsApp" value={effectiveSessionId} onChange={(event) => setSelectedSessionId(event.target.value)}>{activeSessions.map((session) => <option key={session.id} value={session.id}>{session.label || session.name || session.sessionName || session.id}</option>)}</select></> : <span>Sem sessão WAHA conectada</span>}<button type="button" onClick={() => window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Integrações' }))}>Configurar <ExternalLink size={12} /></button></div>{localDemo && channel === 'WhatsApp' && <div className="ns-info-note" role="status">Demonstração local: respostas ficam neste navegador e não são enviadas pelo WhatsApp.</div>}{sessionError && channel === 'WhatsApp' && <div className="dashboard-data-error ns-session-error" role="alert">{sessionError}<button type="button" onClick={() => setRetrySessions((value) => value + 1)}>Tentar novamente</button></div>}<div className="ns-chat-history"><div className="ns-date-divider"><span>{channel === 'E-mail' ? current?.subject || 'Histórico de e-mail' : 'Histórico WhatsApp'}</span></div>{history.map((message, index) => <div className={`ns-message ${message.side}`} key={`${message.clientMessageId || message.providerMessageId || message.time}-${index}`}>{message.text}{message.attachment && <small><Paperclip size={11}/>{message.attachment}</small>}<small>{message.time}{message.side === 'sent' && <Check size={12} />}</small></div>)}</div>{!canReply && <div className="ns-info-note ns-chat-resolved-note" role="status">Este atendimento está resolvido. Use “Reabrir atendimento” no painel do contato para enviar uma nova resposta.</div>}<form className="ns-compose" onSubmit={send}>{<label className="ns-attach-control" title={attachment?.name || 'Anexar arquivo'}><Plus size={18}/><input key={attachment?.name || 'empty-attachment'} type="file" aria-label="Anexar arquivo" disabled={!canReply || sending} onChange={(event) => setAttachment(event.target.files?.[0] || null)}/></label>}{attachment && <button className="ns-attachment-chip" type="button" onClick={() => setAttachment(null)} aria-label={`Remover anexo ${attachment.name}`}><span>{attachment.name}</span><X size={13}/></button>}<input aria-label="Escrever mensagem" placeholder={!canReply ? 'Reabra o atendimento para responder...' : channel === 'WhatsApp' ? 'Escreva uma mensagem via WhatsApp...' : 'Escreva uma resposta por e-mail...'} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!current || sending || !canReply} /><button className="ns-send" aria-label="Enviar mensagem" type="submit" disabled={!current || sending || !canReply || (!draft.trim() && !attachment)}><Send size={16} /></button></form><footer className="ns-chat-foot">{localDemo && channel === 'WhatsApp' ? 'Mensagens simuladas neste navegador' : channel === 'E-mail' ? 'E-mails sincronizados com a conta conectada' : effectiveSessionId ? 'Mensagens sincronizadas com WAHA' : 'Conecte uma sessão WAHA para enviar'}<span>{emailLoading && channel === 'E-mail' ? 'Atualizando caixa...' : emailError && channel === 'E-mail' ? emailError.message : sending ? 'Enviando...' : 'Entrada atualizada automaticamente'}</span></footer></section><aside className="ns-contact-panel"><div className="ns-contact-profile"><span className={`ns-avatar large ${current?.color || 'blue'}`}>{current?.initials || current?.name?.slice(0, 1)}</span><b>{current?.name || 'Sem conversa selecionada'}</b><small>{current?.company}</small><button type="button" onClick={openClientRecord} disabled={!current}>{linkedClient ? 'Abrir ficha do cliente' : 'Buscar cliente'} <ChevronRight size={14} /></button></div><div className="ns-contact-block"><span>Contato</span><b>{current?.phone || 'Telefone não informado'}</b><small>{current?.email || 'E-mail não informado'}</small></div><div className="ns-contact-block"><span>Responsavel</span><select aria-label="Responsavel pelo atendimento" value={current?.assigneeId || teamMembers.find((member) => member.name === current?.owner)?.id || ''} disabled={!current} onChange={(event) => assignConversation(event.target.value)}><option value="">Sem responsavel</option>{teamMembers.map((member) => <option key={member.id} value={member.id}>{member.name} ({member.role})</option>)}</select></div>{current && <button type="button" className="ns-link-task" onClick={() => setConversationStatus(nextInboxConversationStatus(current))} disabled={!current}><BadgeCheck size={15}/>{isResolvedInboxConversation(current) ? 'Reabrir atendimento' : 'Resolver atendimento'}</button>}<button type="button" className="ns-link-task" onClick={() => { setTaskError(''); setTaskDue(nextInboxFollowUpDate()); setTaskOpen(true); }} disabled={!current || taskCreating}><Plus size={15} />{taskCreating ? 'Criando tarefa...' : 'Criar tarefa de retorno'}</button></aside>
    {newOpen && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (!sending && event.target === event.currentTarget) setNewOpen(false); }}><form className="ns-integration-modal" role="dialog" aria-modal="true" aria-labelledby="inbox-compose-title" aria-busy={sending} onSubmit={createConversation}><header><span className="ns-integration-logo"><MessageCircle size={18}/></span><div><h2 id="inbox-compose-title">{channel === 'E-mail' ? 'Novo e-mail' : 'Nova conversa'}</h2><p>{channel === 'E-mail' ? 'Envie uma mensagem usando a conta de e-mail conectada.' : 'Crie um atendimento WhatsApp vinculado a um contato.'}</p></div><button type="button" aria-label="Fechar" disabled={sending} onClick={() => setNewOpen(false)}><X size={17}/></button></header>{conversationError && <div className="dashboard-data-error" role="alert">{conversationError}<button type="button" onClick={() => setConversationError('')}>Fechar</button></div>}<div className="ns-integration-fields"><label>Nome<input autoFocus required={channel === 'WhatsApp'} value={newContact.name} onChange={(event) => setNewContact({ ...newContact, name: event.target.value })}/></label><label>Empresa / cliente<input required={channel === 'WhatsApp'} value={newContact.company} onChange={(event) => setNewContact({ ...newContact, company: event.target.value })}/></label><label>Telefone<input required={channel === 'WhatsApp'} value={newContact.phone} onChange={(event) => setNewContact({ ...newContact, phone: event.target.value })}/></label><label>E-mail<input required={channel === 'E-mail'} type="email" value={newContact.email} onChange={(event) => setNewContact({ ...newContact, email: event.target.value })}/></label>{channel === 'E-mail' && <><label>Assunto<input required value={newContact.subject || ''} onChange={(event) => setNewContact({ ...newContact, subject: event.target.value })}/></label><label>Mensagem<textarea required rows="5" value={newContact.body || ''} onChange={(event) => setNewContact({ ...newContact, body: event.target.value })}/></label><label>Anexo (opcional)<input type="file" onChange={(event) => setAttachment(event.target.files?.[0] || null)}/></label>{attachment && <small>{attachment.name} ? {(attachment.size / 1024 / 1024).toFixed(2)} MiB</small>}</>}{channel === 'WhatsApp' && <label>Responsavel<select value={owner} onChange={(event) => setOwner(teamMembers.find((member) => member.name === event.target.value)?.name || '')}><option value="">Sem responsavel</option>{teamMembers.map((member) => <option key={member.id} value={member.name}>{member.name} ({member.role})</option>)}</select></label>}{channel === 'WhatsApp' && activeSessions.length > 0 && <label>Sessão WAHA<select value={selectedSessionId || activeSessions[0].id} onChange={(event) => setSelectedSessionId(event.target.value)}>{activeSessions.map((session) => <option key={session.id} value={session.id}>{session.label || session.name || session.sessionName || session.id}</option>)}</select></label>}</div><div className="ns-integration-modal-note"><ShieldCheck size={15}/>{channel === 'E-mail' ? 'O envio será registrado na conta de e-mail conectada.' : 'A mensagem só será enviada ao clicar em Enviar.'}</div><footer><button className="ns-secondary" type="button" disabled={sending} onClick={() => setNewOpen(false)}>Cancelar</button><button className="ns-primary" type="submit" disabled={sending || (channel === 'E-mail' && (emailLoading || !emailProviders.length))}><Check size={14}/>{sending ? (channel === 'E-mail' ? 'Enviando...' : 'Criando...') : channel === 'E-mail' ? (emailProviders.length ? 'Enviar e-mail' : 'Conecte uma conta') : 'Criar conversa'}</button></footer></form></div>}{taskOpen && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (!taskCreating && event.target === event.currentTarget) setTaskOpen(false); }}><form className="ns-integration-modal" role="dialog" aria-modal="true" aria-labelledby="inbox-follow-up-title" aria-busy={taskCreating} onSubmit={createTask}><header><span className="ns-integration-logo"><CalendarClock size={18}/></span><div><h2 id="inbox-follow-up-title">Agendar retorno</h2><p>Crie uma tarefa com prazo e vínculo ao atendimento selecionado.</p></div><button type="button" aria-label="Fechar" disabled={taskCreating} onClick={() => setTaskOpen(false)}><X size={17}/></button></header>{taskError && <div className="dashboard-data-error" role="alert">{taskError}</div>}<div className="ns-integration-fields"><label>Contato<input readOnly value={current?.name || ''}/></label><label>Prazo do retorno<input type="date" required min={localDateInput()} value={taskDue} onChange={(event) => setTaskDue(event.target.value)}/></label><label>Responsável<select value={owner} onChange={(event) => setOwner(event.target.value)}><option value="">Sem responsável</option>{teamMembers.map((member) => <option key={member.id} value={member.name}>{member.name} ({member.role})</option>)}</select></label></div><div className="ns-integration-modal-note"><ShieldCheck size={15}/>{linkedClient ? `A tarefa será vinculada à ficha de ${linkedClient.name}.` : `Cliente: ${current?.company || 'não identificado'}. Não encontrei um vínculo exato com uma ficha do CRM.`}</div><footer><button className="ns-secondary" type="button" disabled={taskCreating} onClick={() => setTaskOpen(false)}>Cancelar</button><button className="ns-primary" type="submit" disabled={taskCreating || !taskDue}><Check size={14}/>{taskCreating ? 'Agendando...' : 'Agendar retorno'}</button></footer></form></div>}</div>;
}

function Tickets({ notify, navigationContext = null, onNavigationContextConsumed = () => {} }) {
  const preferences = useWorkspacePreferences();
  const { records: rows, loading, error, refresh, create, update, remove } = useWorkspaceRecords('tickets');
  const [form, setForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [ticketBusy, setTicketBusy] = useState('');
  const [ticketActionError, setTicketActionError] = useState('');
  const [ticketFilter, setTicketFilter] = useState('Todos');
  const [slaNow, setSlaNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setSlaNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const clientsStore = useWorkspaceRecords('clients');
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(true);
  const [teamMembersError, setTeamMembersError] = useState('');
  useEffect(() => {
    let mounted = true;
    apiRequest('/api/workspace/assignees').then((result) => {
      if (mounted) { setTeamMembers(Array.isArray(result.data) ? result.data : []); setTeamMembersError(''); }
    }).catch((error) => { if (mounted) setTeamMembersError(error.message || 'Não foi possível carregar a equipe.'); })
      .finally(() => { if (mounted) setTeamMembersLoading(false); });
    return () => { mounted = false; };
  }, []);
  const [draft, setDraft] = useState({ title: '', client: '', clientId: '', priority: 'Media', ownerId: '', detail: '', slaHours: '24' });
  useEffect(() => { if (!navigationContext?.clientId) return; setDraft((current) => ({ ...current, clientId: navigationContext.clientId, client: navigationContext.clientName || '' })); if (navigationContext.action === 'create') setForm(true); onNavigationContextConsumed(); }, [navigationContext?.intentId]);
  const [edit, setEdit] = useState({ status: '', owner: '', ownerId: '', priority: '', detail: '', note: '' });
  const addTicket = async (event) => { event.preventDefault(); const client = clientsStore.records.find((item) => String(item.id) === String(draft.clientId)); if (!draft.title.trim() || !client) { setTicketActionError('Informe a solicitação e selecione um cliente cadastrado.'); return; } const assignee = teamMembers.find((member) => String(member.id) === String(draft.ownerId)); setTicketBusy('create'); setTicketActionError(''); try { const now = new Date().toISOString(); await create({ code: `NX-${globalThis.crypto.randomUUID().slice(0, 8).toUpperCase()}`, title: draft.title.trim(), client: client.name, clientId: client.id, priority: draft.priority, status: 'Aberto', updatedAt: now, slaDueAt: ticketSlaDeadline(draft.slaHours), detail: draft.detail.trim(), owner: assignee?.name || '', ownerId: assignee?.id || '', activity: [{ id: globalThis.crypto.randomUUID(), type: 'created', message: 'Ticket criado', author: assignee?.name || 'Equipe', at: now }] }); setDraft({ title: '', client: '', clientId: '', priority: 'Media', ownerId: '', detail: '', slaHours: '24' }); setForm(false); notify('Ticket salvo e vinculado ao cliente.'); } catch (saveError) { setTicketActionError(saveError.message || 'Não foi possível salvar o ticket. Seus dados continuam no formulário.'); } finally { setTicketBusy(''); } };
  const openTicket = (key) => { const row = findTicketByActionKey(rows, key); if (!row) return notify('Este ticket nÃ£o estÃ¡ mais disponÃ­vel. Atualize a lista.'); setSelected(row); setEdit({ status: normalizeTicketStatus(row.status) || 'Aberto', owner: row.owner || '', ownerId: ticketAssigneeOptionValue(row, teamMembers), priority: normalizeTicketPriority(row.priority), detail: row.detail || '', note: '' }); };
  const saveTicket = async (event) => {
    event.preventDefault();
    const changes = [];
    if (normalizeTicketStatus(edit.status) !== normalizeTicketStatus(selected.status)) changes.push(`Status alterado para ${edit.status}`);
    if (edit.owner.trim() !== String(selected.owner || '').trim()) changes.push(edit.owner.trim() ? `Responsável atribuído a ${edit.owner.trim()}` : 'Responsável removido');
    if (normalizeTicketPriority(edit.priority) !== normalizeTicketPriority(selected.priority)) changes.push(`Prioridade alterada para ${ticketPriorityLabel(edit.priority)}`);
    if (edit.detail.trim() !== String(selected.detail || '').trim()) changes.push('Descrição atualizada');
    const note = edit.note.trim();
    if (!changes.length && !note) { notify('Nenhuma alteração para salvar.'); return; }
    const now = new Date().toISOString();
    const activity = [...(Array.isArray(selected.activity) ? selected.activity : []), ...changes.map((message) => ({ id: globalThis.crypto.randomUUID(), type: 'change', message, author: edit.owner.trim() || 'Equipe', at: now })), ...(note ? [{ id: globalThis.crypto.randomUUID(), type: 'note', message: note, author: edit.owner.trim() || 'Equipe', at: now }] : [])].slice(-100);
    setTicketBusy('save'); setTicketActionError('');
    try { await update(selected.id, { priority: edit.priority, status: edit.status, updatedAt: now, detail: edit.detail.trim(), owner: edit.owner.trim(), ownerId: ticketAssigneeOptionValue(edit, teamMembers) === '__legacy__' ? '' : ticketAssigneeOptionValue(edit, teamMembers), activity }); setSelected(null); notify(note ? 'Ticket atualizado e nota interna registrada.' : 'Ticket atualizado no workspace.'); }
    catch (saveError) { setTicketActionError(saveError.message || 'Não foi possível atualizar o ticket. Suas alterações continuam abertas.'); }
    finally { setTicketBusy(''); }
  };
  const deleteTicket = async (ticket) => { if (!confirmWorkspaceDelete(`Excluir permanentemente o ticket ${ticket.code}?`, preferences)) return; setTicketBusy('delete'); setTicketActionError(''); try { await remove(ticket.id); setSelected(null); notify(`Ticket ${ticket.code} excluído.`); } catch (deleteError) { setTicketActionError(deleteError.message || 'Não foi possível excluir o ticket.'); } finally { setTicketBusy(''); } };
  const overdueSlaCount = countOverdueTickets(rows, slaNow);
  const cards = [['Abertos', rows.filter((row) => normalizeTicketStatus(row.status) === 'Aberto').length, 'blue'], ['Em andamento', rows.filter((row) => normalizeTicketStatus(row.status) === 'Em andamento').length, 'purple'], ['Aguardando cliente', rows.filter((row) => normalizeTicketStatus(row.status) === 'Aguardando cliente').length, 'orange'], ['Resolvidos', rows.filter((row) => normalizeTicketStatus(row.status) === 'Resolvido').length, 'green'], ['Fora do SLA', overdueSlaCount, 'orange']];
  const visibleTicketRows = filterSupportTickets(rows, ticketFilter, slaNow).map((row) => Object.assign([row.code, row.title, row.client, ticketPriorityLabel(row.priority), row.status, ticketSlaLabel(row, slaNow), row.updatedAt ? new Date(row.updatedAt).toLocaleString('pt-BR') : ''], { recordId: row.id }));
  const exportTickets = () => {
    const data = [['Código', 'Solicitação', 'Cliente', 'Prioridade', 'Status', 'SLA', 'Responsável', 'Atualizado'], ...rows.map((row) => [row.code, row.title, row.client, row.priority === 'Media' ? 'Média' : row.priority, row.status, ticketSlaLabel(row, slaNow), row.owner || '', row.updatedAt || ''])];
    downloadCsvFile(`tickets-${localDateInput()}.csv`, rowsToCsv(data));
    notify('CSV da fila de tickets exportado.');
  };
  return <>{loading && <div className="ns-empty-history">Carregando tickets...</div>}{error && <div className="dashboard-data-error" role="alert">{error}<button type="button" onClick={refresh}>Tentar novamente</button></div>}<div className="ns-ticket-stats">{cards.map(([label, value, color]) => <article key={label}><span className={`ns-stat-mark ${color}`} /><span>{label}</span><b>{value}</b></article>)}</div><div className="ns-filter-tabs compact ns-ticket-filters" role="group" aria-label="Filtrar fila de tickets">{ticketQueueFilters.map((item) => <button type="button" key={item} aria-pressed={ticketFilter === item} className={ticketFilter === item ? 'selected' : ''} onClick={() => setTicketFilter(item)}>{item}</button>)}</div>{form && <form className="ns-inline-form ns-ticket-compose" aria-busy={ticketBusy === '' ? undefined : 'true'} onSubmit={addTicket}><div><b>Novo ticket</b><small>Registre a solicitação e atribua um responsável</small></div><input aria-label="Resumo do ticket" required maxLength={180} placeholder="O que precisa ser resolvido?" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /><textarea aria-label={'Descri\u00e7\u00e3o do ticket'} required maxLength={5000} rows={2} placeholder="Contexto, passos para reproduzir e resultado esperado" value={draft.detail} onChange={(event) => setDraft({ ...draft, detail: event.target.value })} /><select aria-label="Cliente" required value={draft.clientId} onChange={(event) => { const client = clientsStore.records.find((item) => String(item.id) === String(event.target.value)); setDraft({ ...draft, clientId: client?.id || '', client: client?.name || '' }); }}><option value="">Selecione um cliente cadastrado</option>{clientsStore.records.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select><select aria-label="Prioridade" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}><option>Baixa</option><option value="Media">M&#233;dia</option><option>Alta</option><option>Urgente</option></select><label>SLA<select aria-label="Prazo de atendimento" value={draft.slaHours} onChange={(event) => setDraft({ ...draft, slaHours: event.target.value })}><option value="4">4 horas</option><option value="8">8 horas</option><option value="24">24 horas</option><option value="48">48 horas</option><option value="">Sem prazo</option></select></label><label>Responsável<select aria-label="Responsável pelo ticket" disabled={teamMembersLoading} value={draft.ownerId} onChange={(event) => setDraft({ ...draft, ownerId: event.target.value })}><option value="">Sem responsável</option>{teamMembers.map((member) => <option key={member.id} value={member.id}>{member.name} ({member.role})</option>)}</select></label>{teamMembersError && <div className="ns-info-note ns-ticket-form-error" role="alert">{teamMembersError}<button type="button" disabled={teamMembersLoading} onClick={async () => { setTeamMembersLoading(true); setTeamMembersError(""); try { const result = await apiRequest("/api/workspace/assignees"); setTeamMembers(Array.isArray(result.data) ? result.data : []); } catch (error) { setTeamMembersError(error.message || "Falha ao carregar a equipe."); } finally { setTeamMembersLoading(false); } }}>Tentar novamente</button></div>}{clientsStore.error && <div className="dashboard-data-error ns-ticket-form-error" role="alert">{clientsStore.error}<button type="button" onClick={clientsStore.refresh}>Recarregar clientes</button></div>}{!clientsStore.loading && !clientsStore.error && clientsStore.records.length === 0 && <div className="ns-info-note ns-ticket-form-error" role="status">Cadastre um cliente antes de abrir um ticket.<button type="button" onClick={() => navigateTo('Clientes')}>Abrir clientes</button></div>}{ticketActionError && <div className="dashboard-data-error ns-ticket-form-error" role="alert">{ticketActionError}</div>}<button className="ns-primary" type="submit" disabled={Boolean(ticketBusy) || clientsStore.loading || !clientsStore.records.length}><Check size={15} />{ticketBusy === 'create' ? 'Salvando...' : 'Criar ticket'}</button><IconButton label="Fechar formulario" disabled={Boolean(ticketBusy)} onClick={() => setForm(false)}><X size={16} /></IconButton></form>}{!form && <div className="ns-section-heading"><div><h2>Fila de atendimento</h2><p>Abra um ticket para atualizar prioridade, responsável, status e detalhes.</p></div><div className="ns-support-actions"><button className="ns-secondary" type="button" onClick={exportTickets} disabled={!rows.length}><Download size={14} />Exportar CSV</button><button className="ns-secondary" type="button" onClick={() => setForm((value) => !value)}><Plus size={15} />Novo ticket</button></div></div>}<DataTable columns={['Ticket', 'Solicitação', 'Cliente', 'Prioridade', 'Status', 'SLA', 'Atualizado']} rows={visibleTicketRows} search onAction={openTicket} onEdit={openTicket} statusIndex={4} />
    {selected && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (!ticketBusy && event.target === event.currentTarget) setSelected(null); }}><form className="ns-integration-modal" role="dialog" aria-modal="true" aria-labelledby="ticket-dialog-title" aria-busy={Boolean(ticketBusy)} onSubmit={saveTicket}><header><span className="ns-integration-logo"><LifeBuoy size={18}/></span><div><h2 id="ticket-dialog-title">{selected.code} · {selected.title}</h2><p>{selected.client} · atualizado {selected.updatedAt ? new Date(selected.updatedAt).toLocaleString('pt-BR') : ''}</p></div><button type="button" aria-label="Fechar" disabled={Boolean(ticketBusy)} onClick={() => setSelected(null)}><X size={17}/></button></header>{ticketActionError && <div className="dashboard-data-error" role="alert">{ticketActionError}<button type="button" onClick={() => setTicketActionError('')}>Fechar</button></div>}<div className="ns-integration-modal-note"><Clock3 size={15}/>SLA: {ticketSlaLabel(selected, slaNow)}{selected.slaDueAt ? ` · limite ${new Date(selected.slaDueAt).toLocaleString('pt-BR')}` : ''}</div><div className="ns-integration-fields"><label>Status<select value={edit.status} onChange={(event) => setEdit({ ...edit, status: event.target.value })}>{ticketStatusOptions(edit.status).map((value) => <option key={value}>{value}</option>)}</select></label><label>Prioridade<select value={edit.priority} onChange={(event) => setEdit({ ...edit, priority: event.target.value })}>{['Baixa','Media','Alta','Urgente'].map((value) => <option key={value} value={value}>{value === 'Media' ? 'Média' : value}</option>)}</select></label><label>Responsável<select disabled={teamMembersLoading} value={ticketAssigneeOptionValue(edit, teamMembers)} onChange={(event) => { const assignee = ticketAssigneeFromOption(event.target.value, teamMembers, edit.owner); setEdit({ ...edit, ...assignee }); }}><option value="">Sem responsável</option>{edit.owner && ticketAssigneeOptionValue(edit, teamMembers) === "__legacy__" && <option value="__legacy__">Responsável registrado: {edit.owner} (fora da equipe)</option>}{teamMembers.map((member) => <option key={member.id} value={member.id}>{member.name} ({member.role})</option>)}</select></label><label>Cliente<input readOnly value={selected.client}/></label><label className="wide">Descrição<textarea rows="4" value={edit.detail} onChange={(event) => setEdit({ ...edit, detail: event.target.value })} placeholder="Contexto, passos para reproduzir e solução"/></label></div><section className="ns-ticket-activity" aria-label="Histórico do ticket"><div className="ns-ticket-activity-heading"><h3>Histórico</h3><small>{Array.isArray(selected.activity) ? selected.activity.length : 0} atualizações</small></div>{Array.isArray(selected.activity) && selected.activity.length > 0 ? <ol>{selected.activity.slice(-8).reverse().map((entry, index) => <li key={entry.id || index}><span><b>{entry.author || 'Equipe'}</b><small>{entry.at ? new Date(entry.at).toLocaleString('pt-BR') : 'Data não informada'}</small></span><p>{entry.message}</p></li>)}</ol> : <p className="ns-ticket-activity-empty">Ainda não há atualizações. As alterações e notas serão registradas aqui.</p>}<label>Nota interna<textarea maxLength={1500} rows={3} placeholder="Registre um contexto para a equipe…" value={edit.note} onChange={(event) => setEdit({ ...edit, note: event.target.value })} /></label></section><footer><button className="ns-secondary ns-ticket-archive" type="button" disabled={Boolean(ticketBusy)} onClick={() => deleteTicket(selected)}><Trash2 size={14}/>Excluir ticket</button><button className="ns-secondary" type="button" disabled={Boolean(ticketBusy)} onClick={() => { setTicketActionError(''); setSelected(null); }}>Cancelar</button><button className="ns-primary" type="submit" disabled={Boolean(ticketBusy)}><Check size={14}/>{ticketBusy === 'save' ? 'Salvando...' : 'Salvar ticket'}</button></footer></form></div>}
  </>;
}

function Sites({ page, notify }) {
  const preferences = useWorkspacePreferences();
  const assetsStore = useWorkspaceRecords('site-assets');
  const clientsStore = useWorkspaceRecords('clients');
  const monitorsStore = useWorkspaceRecords('monitors');
  const assetsState = assetsStore.records;
  const [checkingIds, setCheckingIds] = useState(() => new Set());
  const checkingIdsRef = useRef(new Set());
  const [historyAsset, setHistoryAsset] = useState(null);
  const [siteHistory, setSiteHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const historyRequestId = useRef(0);
  const [scheduleIntervals, setScheduleIntervals] = useState({});
  const [scheduleBusyId, setScheduleBusyId] = useState('');
  const [removingAssetId, setRemovingAssetId] = useState('');
  const [scheduleError, setScheduleError] = useState({});
  const [checkError, setCheckError] = useState({});
  const toggleSiteSchedule = async (asset) => {
    if (scheduleBusyId) return;
    setScheduleBusyId(String(asset.id));
    setScheduleError((current) => ({ ...current, [asset.id]: '' }));
    const state = siteMonitorScheduleState(asset.id, monitorsState);
    const minutes = Number(scheduleIntervals[asset.id] || siteMonitorIntervalForAsset(asset.id, monitorsState));
    try {
      if (state.enabled) {
        if (siteMonitorScheduleState(asset.id, monitorsState, minutes).intervalNeedsSave) {
          const nextCheckAt = new Date(Date.now() + minutes * 60_000).toISOString();
          for (const linked of state.enabledSchedules) await monitorsStore.update(linked.id, { intervalMinutes: minutes, nextCheckAt });
          setScheduleIntervals((current) => ({ ...current, [asset.id]: String(minutes) }));
          notify(`Intervalo atualizado para ${minutes} minutos. A próxima checagem seguirá o novo prazo.`);
        } else {
          for (const linked of state.enabledSchedules) await monitorsStore.update(linked.id, { enabled: false, nextCheckAt: null });
          notify('Checagens automáticas pausadas.');
        }
      } else {
        const data = { siteAssetId: asset.id, name: asset.name, clientId: asset.clientId || null, intervalMinutes: minutes, enabled: true, nextCheckAt: new Date().toISOString() };
        if (state.schedules.length) {
          for (const linked of state.schedules) await monitorsStore.update(linked.id, data);
        }
        else await monitorsStore.create(data);
        notify(`Checagens automáticas ativadas a cada ${minutes} minutos. A primeira ocorre em até 1 minuto.`);
      }
    } catch (error) { setScheduleError((current) => ({ ...current, [asset.id]: error.message || 'Não foi possível atualizar o agendamento.' })); }
    finally { setScheduleBusyId(''); }
  };
  const openSiteHistory = async (asset) => {
    const requestId = ++historyRequestId.current;
    setHistoryAsset(asset);
    setHistoryLoading(true);
    setHistoryError('');
    try { const result = await apiRequest(`/api/monitoring/site-assets/${encodeURIComponent(asset.id)}/history`); if (historyRequestId.current === requestId) setSiteHistory(Array.isArray(result.data) ? result.data : []); }
    catch (error) { if (historyRequestId.current === requestId) setHistoryError(error.message || 'Não foi possível carregar o histórico.'); }
    finally { if (historyRequestId.current === requestId) setHistoryLoading(false); }
  };
  const exportAssets = (records, filename) => {
    const data = [['Ativo', 'Cliente', 'Tipo', 'Renovação', 'DNS', 'Renovação automática', 'Saúde', 'HTTP', 'Latência (ms)', 'Verificado em', 'SSL expira em'], ...records.map((asset) => [asset.name, asset.client || clientsStore.records.find((client) => String(client.id) === String(asset.clientId))?.name || '', asset.type || '', asset.renewalDate || asset.renewal || '', asset.dnsProvider || '', asset.autoRenew === true ? 'Ativa' : asset.autoRenew === false ? 'Inativa' : '', asset.health || '', asset.httpStatus ?? '', asset.latencyMs ?? '', asset.checkedAt || '', asset.sslExpiresAt || ''])];
    downloadCsvFile(`${filename}-${localDateInput()}.csv`, rowsToCsv(data));
    notify('CSV dos ativos exportado.');
  };
  const checkSite = async (asset) => {
    if (!beginSiteCheck(checkingIdsRef.current, asset.id)) return;
    setCheckingIds(new Set(checkingIdsRef.current));
    setCheckError((current) => ({ ...current, [asset.id]: '' }));
    try {
      const result = await apiRequest('/api/monitoring/site-assets/' + encodeURIComponent(asset.id) + '/check', { method: 'POST', body: '{}' });
      assetsStore.setRecords((current) => current.map((item) => String(item.id) === String(result.data.id) ? result.data : item));
      notify(result.data.demo ? 'Verificação simulada registrada no ambiente local.' : result.data.health === 'Online' ? 'Site respondeu. Status e certificado foram atualizados.' : 'Site não respondeu; confira endereço e hospedagem.');
    } catch (error) { setCheckError((current) => ({ ...current, [asset.id]: error.message || 'Não foi possível verificar o ativo. Tente novamente.' })); }
    finally {
      const next = finishSiteCheck(checkingIdsRef.current, asset.id);
      checkingIdsRef.current = next;
      setCheckingIds(next);
    }
  };
  const monitorsState = monitorsStore.records;
  const siteSchedule = (assetId) => {
    return siteMonitorScheduleState(assetId, monitorsState, scheduleIntervals[assetId] || siteMonitorIntervalForAsset(assetId, monitorsState));
  };
  const removeSiteAsset = async (asset) => {
    if (!canRemoveSiteAsset({ monitorsLoading: monitorsStore.loading, monitorsError: monitorsStore.error }) || removingAssetId) return;
    if (!confirmWorkspaceDelete(`Remover ${asset.name} do cadastro?`, preferences)) return;
    setRemovingAssetId(String(asset.id));
    try {
      const linkedSchedules = siteMonitorSchedulesForAsset(asset.id, monitorsState);
      for (const schedule of linkedSchedules) await monitorsStore.remove(schedule.id);
      await assetsStore.remove(asset.id);
      setExpanded((current) => current === String(asset.id) ? '' : current);
      notify('Ativo e agenda de monitoramento removidos do workspace.');
    } catch (error) { notify(error.message || 'Não foi possível remover o ativo e sua agenda.'); }
    finally { setRemovingAssetId(''); }
  };
  const scheduleButtonLabel = (asset) => {
    const schedule = siteSchedule(asset.id);
    if (!schedule.enabled) return 'Agendar';
    return schedule.intervalNeedsSave ? 'Salvar intervalo' : 'Pausar agenda';
  };
  const [assetModal, setAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);
  const [assetSaving, setAssetSaving] = useState(false);
  const [assetFormError, setAssetFormError] = useState('');
  const emptyAssetDraft = { name: '', url: '', clientId: '', type: 'Domínio + hospedagem', renewalDate: '', dnsProvider: '', autoRenew: '' };
  const [assetDraft, setAssetDraft] = useState(emptyAssetDraft);
  const visible = page === 'dominios' ? assetsState.filter((asset) => String(asset.type || '').toLowerCase().startsWith('dom')) : page === 'hospedagens' ? assetsState.filter((asset) => String(asset.type || '').toLowerCase().includes('hospedagem')) : assetsState;
  const editAsset = (asset) => {
    setAssetFormError('');
    setEditingAsset(asset);
    const parsedRenewalDate = renewalDateFor(asset);
    setAssetDraft({ name: asset.name || '', url: siteAssetUrlForEdit(asset), clientId: String(asset.clientId || ''), type: asset.type || 'Domínio + hospedagem', renewalDate: parsedRenewalDate ? localDateInput(parsedRenewalDate) : '', dnsProvider: asset.dnsProvider || '', autoRenew: asset.autoRenew === true ? 'yes' : asset.autoRenew === false ? 'no' : '' });
    setAssetModal(true);
  };
  const addAsset = async (event) => {
    event.preventDefault();
    const client = clientsStore.records.find((item) => String(item.id) === String(assetDraft.clientId));
    let data;
    try { data = buildSiteAssetPayload(assetDraft, client); }
    catch (error) { setAssetFormError(error.message); return; }
    setAssetSaving(true);
    setAssetFormError('');
    try {
      if (editingAsset) await assetsStore.update(editingAsset.id, data);
      else await assetsStore.create({ ...data, health: 'Não verificado' });
      setAssetModal(false);
      setEditingAsset(null);
      setAssetDraft(emptyAssetDraft);
      notify(editingAsset ? 'Ativo atualizado no workspace.' : 'Ativo salvo no workspace e vinculado ao cliente.');
    } catch (error) { setAssetFormError(error.message || 'Não foi possível salvar o ativo. Seus dados continuam no formulário.'); }
    finally { setAssetSaving(false); }
  };
  const renewalDateFor = (asset) => siteRenewalDate(asset.renewalDate || asset.renewal);
  const renewalSummary = summarizeSiteRenewals(visible);
  const [expanded, setExpanded] = useState('');
  if (page === 'monitoramento') {
    const checked = assetsState.filter((item) => item.checkedAt);
    const online = checked.filter((item) => item.health === 'Online').length;
    return <><div className="ns-metrics ns-metrics-three"><Metric label="Ativos monitoráveis" value={String(assetsState.length)} note="domínios e sites cadastrados" icon={Activity} /><Metric label="Online na última consulta" value={checked.length ? online + '/' + checked.length : '?'} note="verificações manuais registradas" icon={TrendingUp} /><Metric label="Offline na última consulta" value={String(checked.filter((item) => item.health === 'Offline').length)} note="rever endereço ou hospedagem" icon={AlertCircle} /></div>{assetsStore.loading && <p className="ns-empty-history">Carregando ativos...</p>}{assetsStore.error && <div className="dashboard-data-error" role="alert">{assetsStore.error}<button type="button" onClick={assetsStore.refresh}>Tentar novamente</button></div>}{monitorsStore.error && <div className="dashboard-data-error" role="alert">{monitorsStore.error}<button type="button" onClick={monitorsStore.refresh}>Tentar novamente</button></div>}{monitorsStore.loading && <p className="ns-info-note" role="status">Carregando estado dos agendamentos...</p>}<div className="ns-section-heading"><div><h2>Verifica&#231;&#245;es manuais</h2><p>Hist&#243;rico das &#250;ltimas 50 consultas por ativo.</p></div><button type="button" className="ns-secondary" onClick={() => exportAssets(assetsState, 'monitoramento')} disabled={!assetsState.length}><Download size={14} />Exportar CSV</button></div><div className="ns-monitor-list">{assetsState.map((item) => <article className="ns-monitor-row" key={item.id}><span className={'ns-monitor-pulse' + (item.health === 'Offline' ? ' warn' : '')}><i /></span><span className="ns-monitor-main"><b>{item.name}</b><small>{item.url || item.domain || item.name}</small></span><span className={'ns-monitor-status' + (item.health === 'Offline' ? ' warn' : '')}>{item.health || 'Nao verificado'}</span><span className="ns-monitor-data"><small>Ultima verificacao</small><b>{item.checkedAt ? new Date(item.checkedAt).toLocaleString('pt-BR') : '?'}</b></span><span className="ns-monitor-data"><small>SSL expira</small><b>{item.sslExpiresAt ? new Date(item.sslExpiresAt).toLocaleDateString('pt-BR') : '?'}</b></span><div className="ns-monitor-actions"><button type="button" className="ns-secondary" onClick={() => openSiteHistory(item)}>Hist&#243;rico</button><label className="ns-monitor-interval">A cada<select disabled={monitorsStore.loading || Boolean(monitorsStore.error) || scheduleBusyId === String(item.id)} aria-label={`Intervalo de checagem para ${item.name}`} value={scheduleIntervals[item.id] || siteMonitorIntervalForAsset(item.id, monitorsState)} onChange={(event) => setScheduleIntervals((current) => ({ ...current, [item.id]: event.target.value }))}><option value="5">5 min</option><option value="15">15 min</option><option value="30">30 min</option><option value="60">1 hora</option></select></label><button type="button" className="ns-secondary" disabled={monitorsStore.loading || Boolean(monitorsStore.error) || scheduleBusyId === String(item.id)} onClick={() => toggleSiteSchedule(item)}>{monitorsStore.loading ? 'Carregando agenda...' : scheduleBusyId === String(item.id) ? 'Salvando...' : scheduleButtonLabel(item)}</button></div>{scheduleError[item.id] && <div className="dashboard-data-error ns-monitor-inline-error" role="alert">{scheduleError[item.id]}<button type="button" onClick={() => toggleSiteSchedule(item)}>Tentar novamente</button></div>}{checkError[item.id] && <div className="dashboard-data-error ns-monitor-inline-error" role="alert">{checkError[item.id]}<button type="button" onClick={() => checkSite(item)}>Tentar novamente</button></div>}<button className="ns-check-button" type="button" onClick={() => checkSite(item)} disabled={checkingIds.has(String(item.id))}>{checkingIds.has(String(item.id)) ? 'Verificando...' : item.checkedAt ? 'Verificar' : 'Verificar agora'}</button></article>)}{assetsState.length === 0 && !assetsStore.loading && <div className="ns-empty-history">Cadastre um site ou dominio para verificar sua disponibilidade.</div>}</div>{historyAsset && <section className="ns-automation-history" aria-label={`Hist&#243;rico de ${historyAsset.name}`}><div className="ns-section-heading"><div><h2>Hist&#243;rico &#183; {historyAsset.name}</h2><p>At&#233; 50 verifica&#231;&#245;es registradas no workspace.</p></div><button type="button" className="ns-secondary" onClick={() => { historyRequestId.current += 1; setHistoryLoading(false); setHistoryAsset(null); }}>Fechar</button></div>{historyLoading ? <div className="ns-empty-history">Carregando hist&#243;rico...</div> : historyError ? <div className="dashboard-data-error" role="alert">{historyError}<button type="button" onClick={() => openSiteHistory(historyAsset)}>Tentar novamente</button></div> : siteHistory.length ? siteHistory.map((event) => <article className="ns-automation-row" key={event.id}><span className="ns-flow-main"><b>{event.payload?.status || 'Verifica&#231;&#227;o conclu&#237;da'}</b><small>{event.createdAt ? new Date(event.createdAt).toLocaleString('pt-BR') : ''} &#183; {event.payload?.source === 'scheduled' ? 'Agendada' : 'Manual'} &#183; HTTP {event.payload?.httpStatus ?? '?'} &#183; {event.payload?.latencyMs ?? '?'} ms{event.payload?.reason ? ` &#183; ${event.payload.reason}` : ''}</small></span></article>) : <div className="ns-empty-history">Nenhuma verifica&#231;&#227;o registrada para este ativo.</div>}</section>}<div className="ns-info-note"><ShieldCheck size={17} /><span>O agendamento fica desligado por padr&#227;o. Quando ativado, faz consultas no intervalo escolhido; n&#227;o coleta m&#233;tricas em tempo real.</span></div></>;
  }
  return <>{assetsStore.loading && <p className="ns-empty-history">Carregando ativos…</p>}{assetsStore.error && <div className="dashboard-data-error" role="alert">{assetsStore.error}<button type="button" onClick={assetsStore.refresh}>Tentar novamente</button></div>}{monitorsStore.error && <div className="dashboard-data-error" role="alert">Não foi possível carregar os agendamentos. Atualize antes de remover sites ou domínios.<button type="button" disabled={monitorsStore.loading} onClick={monitorsStore.refresh}>Tentar carregar agendamentos</button></div>}<div className="ns-metrics ns-metrics-four"><Metric label="Ativos cadastrados" value={String(visible.length)} note="Sites, domínios e hospedagens" icon={Globe2} /><Metric label="Renovação vencida" value={String(renewalSummary.overdue)} note="Ação necessária" icon={AlertCircle} /><Metric label="Renovam em até 30 dias" value={String(renewalSummary.soon)} note="Com data de renovação cadastrada" icon={CalendarClock} /><Metric label="Sem data de renovação" value={String(renewalSummary.missing)} note="Ativos que precisam de uma data" icon={AlertCircle} /></div><div className="ns-section-heading"><div><h2>Ativos do workspace</h2><p>Cadastros vinculados aos clientes.</p></div><button type="button" className="ns-secondary" onClick={() => exportAssets(visible, page)} disabled={!visible.length}><Download size={14} />Exportar CSV</button></div><div className="ns-assets-list">{visible.map((asset) => { const Icon = (asset.type || '').toLowerCase().includes('hospedagem') ? HardDrive : Globe2; const renewalDateValue = renewalDateFor(asset); const renewalDate = renewalDateValue ? renewalDateValue.toLocaleDateString('pt-BR') : 'Não informada'; return <article className="ns-asset-row" key={asset.id}><span className="ns-asset-icon"><Icon size={19} /></span><span className="ns-asset-main"><b>{asset.name}</b><small>{asset.client || clientsStore.records.find((client) => String(client.id) === String(asset.clientId))?.name || 'Cliente não vinculado'}</small></span><span className="ns-asset-type">{asset.type || 'Tipo não informado'}</span><span className="ns-asset-renew"><small>Renovação</small><b>{renewalDate}</b></span><Status>{asset.health || 'Não verificado'}</Status><IconButton label={`Detalhes de ${asset.name}`} onClick={() => setExpanded(expanded === asset.id ? '' : asset.id)}><ChevronDown size={16} /></IconButton>{expanded === asset.id && <div className="ns-asset-detail">{checkError[asset.id] && <div className="dashboard-data-error ns-asset-action-error" role="alert">{checkError[asset.id]}<button type="button" onClick={() => checkSite(asset)}>Tentar novamente</button></div>}<span>Cliente vinculado <b>{asset.clientId ? 'Sim' : 'Não vinculado'}</b></span><span>DNS <b>{asset.dnsProvider || 'Não informado'}</b></span><span>Renovação automática <b>{asset.autoRenew === true ? 'Ativa' : asset.autoRenew === false ? 'Inativa' : 'Não informado'}</b></span><button type="button" onClick={() => editAsset(asset)}><Pencil size={13} />Editar</button><button type="button" onClick={() => checkSite(asset)} disabled={checkingIds.has(String(asset.id))}><RefreshCw size={13} className={checkingIds.has(String(asset.id)) ? 'ns-spinning' : ''} />{checkingIds.has(String(asset.id)) ? 'Verificando' : 'Verificar'}</button><button type="button" onClick={() => removeSiteAsset(asset)} disabled={!canRemoveSiteAsset({ monitorsLoading: monitorsStore.loading, monitorsError: monitorsStore.error }) || Boolean(removingAssetId)} title={monitorsStore.loading ? 'Aguarde o carregamento dos agendamentos para remover com segurança.' : monitorsStore.error ? 'Não foi possível confirmar os agendamentos. Atualize Monitoramento antes de remover.' : undefined}>{removingAssetId === String(asset.id) ? 'Removendo…' : 'Remover'} <Trash2 size={13} /></button></div>}</article>; })}{visible.length === 0 && !assetsStore.loading && <div className="ns-empty-history">Nenhum ativo cadastrado.</div>}</div><div className="ns-page-bottom"><span><Cloud size={15} /> Ativos salvos no workspace</span><button className="ns-secondary" type="button" onClick={() => { setEditingAsset(null); setAssetDraft(emptyAssetDraft); setAssetFormError(''); setAssetModal(true); }}><Plus size={15} />Adicionar ativo</button></div><div className="ns-info-note"><ShieldCheck size={17} /><span>Status de uptime e SSL não verificado. O cadastro não executa monitoramento automático.</span></div>{assetModal && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(e) => { if (!assetSaving && e.target === e.currentTarget) setAssetModal(false); }}><form className="ns-integration-modal" role="dialog" aria-modal="true" aria-labelledby="asset-dialog-title" aria-busy={assetSaving} onSubmit={addAsset}><header><span className="ns-integration-logo google"><Globe2 size={18} /></span><div><h2 id="asset-dialog-title">{editingAsset ? 'Editar ativo' : 'Adicionar ativo'}</h2><p>{editingAsset ? 'Atualize os dados de renovação e infraestrutura.' : 'Registre um site, domínio ou hospedagem vinculado a um cliente.'}</p></div><button type="button" aria-label="Fechar" disabled={assetSaving} onClick={() => setAssetModal(false)}><X size={17} /></button></header><div className="ns-integration-fields"><label>Nome do ativo<input required autoFocus maxLength={180} value={assetDraft.name} onChange={(e) => setAssetDraft({ ...assetDraft, name: e.target.value })} placeholder="Site institucional" /></label><label>Dom&#237;nio ou URL monitorada<input required maxLength={2048} value={assetDraft.url} onChange={(e) => setAssetDraft({ ...assetDraft, url: e.target.value })} placeholder="https://exemplo.com.br" /></label><label>Cliente cadastrado<select required value={assetDraft.clientId} onChange={(e) => setAssetDraft({ ...assetDraft, clientId: e.target.value })}><option value="">Selecione um cliente</option>{clientsStore.records.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Tipo<select value={assetDraft.type} onChange={(e) => setAssetDraft({ ...assetDraft, type: e.target.value })}><option>Domínio + hospedagem</option><option>Domínio</option><option>Hospedagem</option><option>Site</option></select></label><label>Próxima renovação<input type="date" value={assetDraft.renewalDate} onChange={(e) => setAssetDraft({ ...assetDraft, renewalDate: e.target.value })} /></label><label>Provedor DNS<input maxLength={120} value={assetDraft.dnsProvider} onChange={(e) => setAssetDraft({ ...assetDraft, dnsProvider: e.target.value })} placeholder="Ex.: Cloudflare" /></label><label>Renovação automática<select value={assetDraft.autoRenew} onChange={(e) => setAssetDraft({ ...assetDraft, autoRenew: e.target.value })}><option value="">Não informado</option><option value="yes">Ativa</option><option value="no">Inativa</option></select></label></div>{assetFormError && <div className="dashboard-data-error" role="alert">{assetFormError}<button type="button" onClick={() => setAssetFormError('')}>Fechar</button></div>}{clientsStore.error && <div className="ns-info-note" role="alert">{clientsStore.error}<button type="button" onClick={clientsStore.refresh}>Tentar novamente</button></div>}{clientsStore.records.length === 0 && !clientsStore.loading && <div className="ns-info-note">Cadastre um cliente antes de adicionar um ativo.</div>}<div className="ns-integration-modal-note"><ShieldCheck size={15} />O registro será salvo no banco de dados. O monitoramento precisa ser habilitado separadamente.</div><footer><button className="ns-secondary" type="button" disabled={assetSaving} onClick={() => { setAssetModal(false); setEditingAsset(null); setAssetDraft(emptyAssetDraft); setAssetFormError(''); }}>Cancelar</button><button className="ns-primary" type="submit" disabled={assetSaving || clientsStore.loading || clientsStore.records.length === 0}><Check size={14} />{assetSaving ? 'Salvando...' : editingAsset ? 'Salvar alterações' : 'Salvar ativo'}</button></footer></form></div>}</>;
}

function integrationAuthSummary(name) {
  if (name === 'Mercado Pago') return 'OAuth do Mercado Pago · conecte a conta vendedora deste workspace';
  if (name === 'Google Workspace') return 'OAuth do Google · autorize sua conta';
  if (name === 'WAHA') return 'QR Code · pareie um número WhatsApp';
  if (name === 'Hostinger E-mail') return 'Login da caixa postal · IMAP/SMTP';
  return 'Token ou chave de API · configure no Coolify';
}

function Integrations({ notify }) {
  const localDemo = isLocalDemoActive();
  const currentRole = (() => { try { return JSON.parse(sessionStorage.getItem('nexo.api.user') || 'null')?.role || ''; } catch { return ''; } })();
  const canAuthorizeOAuth = canAuthorizeOAuthIntegrations(currentRole);
  const [integrationStatus, setIntegrationStatus] = useState({});
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusFetchError, setStatusFetchError] = useState('');
  const [filter, setFilter] = useState('Todas');
  const [configuring, setConfiguring] = useState(null);
  const [testing, setTesting] = useState(false);
  const [changingConnection, setChangingConnection] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testHistory, setTestHistory] = useState([]);
  const [testHistoryLoading, setTestHistoryLoading] = useState(false);
  const [testHistoryError, setTestHistoryError] = useState('');
  const testHistoryRequests = useRef(null);
  if (!testHistoryRequests.current) testHistoryRequests.current = createLatestRequestGuard();
  const [hostingerEmail, setHostingerEmail] = useState('');
  const [hostingerPassword, setHostingerPassword] = useState('');
  const [githubOwner, setGithubOwner] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [githubActivity, setGithubActivity] = useState(null);
  const [githubActivityError, setGithubActivityError] = useState('');
  const [githubActivityLoading, setGithubActivityLoading] = useState(false);
  const githubActivityRequests = useRef(null);
  if (!githubActivityRequests.current) githubActivityRequests.current = createLatestRequestGuard();
  const refreshStatus = async () => {
    setStatusLoading(true);
    try {
      const { data } = await apiRequest('/api/integrations/status');
      if (!Array.isArray(data)) throw new Error('A resposta do servidor não trouxe a lista de integrações.');
      setIntegrationStatus(Object.fromEntries(data.map((item) => [item.name, item])));
      setStatusFetchError('');
    } catch (error) {
      const message = error.message || 'Não foi possível consultar o status das integrações.';
      setStatusFetchError(message);
      notify(message);
    }
    finally { setStatusLoading(false); }
  };
  useEffect(() => { refreshStatus(); }, []);
  useEffect(() => {
    const url = new URL(window.location.href);
    const result = url.searchParams.get('google');
    const mercadoPagoResult = url.searchParams.get('mercadopago');
    if (!result && !mercadoPagoResult) return;
    url.searchParams.delete('google');
    url.searchParams.delete('mercadopago');
    const reason = url.searchParams.get('reason');
    url.searchParams.delete('reason');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    if (result === 'connected') notify('Conta Google autorizada com sucesso.');
    else if (result) notify(`Não foi possível conectar o Google (${reason || 'erro de autorização'}). Confira o OAuth e tente novamente.`);
    if (mercadoPagoResult === 'connected') notify('Conta Mercado Pago autorizada para este workspace.');
    else if (mercadoPagoResult) notify(`Não foi possível conectar o Mercado Pago (${reason || 'erro de autorização'}). Confira o cadastro OAuth e tente novamente.`);
    refreshStatus();
  }, []);
  const categories = ['Todas', 'Pagamentos', 'WhatsApp', 'E-mail', 'Produtividade', 'Documentos', 'Desenvolvimento', 'Automações', 'Monitoramento'];
  const setup = {
    'Mercado Pago': { provider: 'mercadopago', vars: ['MERCADOPAGO_CLIENT_ID', 'MERCADOPAGO_CLIENT_SECRET', 'MERCADOPAGO_WEBHOOK_SECRET'], note: 'A conta vendedora é conectada por OAuth e os tokens são criptografados e isolados por workspace. O segredo do webhook continua no Coolify.' },
    'Evolution API': { provider: 'evolution', vars: ['EVOLUTION_API_URL', 'EVOLUTION_API_KEY'], note: 'Informe a URL base da Evolution API e a chave global. O teste lista as instâncias sem exibir a chave.' },
    WAHA: { provider: 'waha', vars: ['WAHA_API_URL', 'WAHA_API_KEY'], note: 'No Coolify, WAHA_API_URL pode apontar para http://waha:3000 quando o serviço está no mesmo Compose.' },
    Resend: { provider: 'resend', vars: ['RESEND_API_KEY'], note: 'O teste consulta os domínios da conta. Ele não envia e-mails.' },
    'Hostinger E-mail': { provider: 'hostinger', vars: [], note: 'Conecte a caixa postal Hostinger. A senha e criptografada no servidor deste workspace.' },
    'Google Workspace': { provider: 'google', vars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'], note: 'Conecte sua conta Google para habilitar Gmail, Calendar, Drive e reuniões Meet. Cadastre no Google Cloud a URI de retorno exibida no servidor.' },
    Clicksign: { provider: 'clicksign', vars: ['CLICKSIGN_API_TOKEN', 'CLICKSIGN_API_BASE_URL', 'CLICKSIGN_WEBHOOK_SECRET'], note: 'Crie um webhook na Clicksign apontando para https://focussdev.space/api/integrations/clicksign/webhook e selecione document_closed, auto_close, close, cancel, deadline, refusal e sign. Copie o segredo HMAC gerado para CLICKSIGN_WEBHOOK_SECRET no Coolify. O teste de conexão não cria nem envia contratos.' },
    GitHub: { provider: 'github', vars: ['GITHUB_TOKEN'], note: 'O teste valida a identidade. Para sincronizar a atividade dos repositórios, o token precisa de leitura de metadados, conteúdo, pull requests e deployments. O Focusshub não publica código nem altera workflows.' },
    n8n: { provider: 'n8n', vars: ['N8N_BASE_URL', 'N8N_API_KEY'], note: 'Gere uma API key em Configurações > n8n API no n8n e salve em N8N_API_KEY no Coolify. O teste consulta a API autenticada de workflows, sem criar, ativar ou executar nenhum fluxo.' },
    Sentry: { provider: 'sentry', vars: ['SENTRY_DSN', 'VITE_SENTRY_DSN'], note: 'Configure o DSN no servidor (API) e no build web. Captura erros sem dados pessoais; o teste não cria um incidente artificial.' },
  };
  const loadTestHistory = async (provider) => {
    const request = testHistoryRequests.current.begin();
    if (!provider) { setTestHistory([]); setTestHistoryError(''); setTestHistoryLoading(false); return; }
    setTestHistoryLoading(true);
    setTestHistoryError('');
    try {
      const result = await apiRequest('/api/integrations/test-history?provider=' + encodeURIComponent(provider) + '&limit=10');
      if (testHistoryRequests.current.isCurrent(request)) setTestHistory(Array.isArray(result.data) ? result.data : []);
    }
    catch (error) {
      if (testHistoryRequests.current.isCurrent(request)) {
        setTestHistory([]);
        setTestHistoryError(error.message || 'Não foi possível carregar o histórico.');
      }
    }
    finally { if (testHistoryRequests.current.isCurrent(request)) setTestHistoryLoading(false); }
  };
  useEffect(() => {
    const provider = configuring ? setup[configuring.name]?.provider : '';
    void loadTestHistory(provider);
  }, [configuring?.name]);
  const testConnection = async () => {
    if (!configuring) return;
    if (localDemo) { setTestResult({ status: 'demo', message: 'Testes externos estão desativados no modo de demonstração. Nenhuma integração foi chamada.' }); return; }
    if (statusFetchError) { setTestResult({ status: 'error', message: 'Atualize o status das integrações antes de testar, para confirmar se o serviço está ativo.' }); return; }
    if (integrationStatus[configuring.name]?.configured && integrationStatus[configuring.name]?.enabled === false) { setTestResult({ status: 'disconnected', message: 'Reative esta integração no Focusshub antes de testar a conexão.' }); return; }
    setTesting(true); setTestResult(null);
    try {
      const result = await apiRequest(`/api/integrations/${setup[configuring.name].provider}/test`, { method: 'POST', body: '{}' });
      setTestResult({ status: result.data.status, message: result.data.message });
      await refreshStatus();
      await loadTestHistory(setup[configuring.name].provider);
    } catch (error) {
      setTestResult({ status: error.code === 'integration_not_configured' ? 'setup_required' : 'error', message: error.message || 'Falha ao testar a conexão.' });
      await refreshStatus();
      await loadTestHistory(setup[configuring.name].provider);
    }
    finally { setTesting(false); }
  };
  const loadGithubActivity = async (event) => {
    event.preventDefault();
    if (localDemo) { setGithubActivityError('Consulta ao GitHub desativada na demonstração local.'); return; }
    const owner = githubOwner.trim();
    const repo = githubRepo.trim();
    const request = startGithubActivityRequest(githubActivityRequests.current, owner, repo, integrationStatus.GitHub);
    if (request.error) {
      setGithubActivityError(request.error);
      return;
    }
    const { requestId } = request;
    setGithubActivityLoading(true);
    setGithubActivityError('');
    try {
      const result = await apiRequest(`/api/integrations/github/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/activity`);
      if (githubActivityRequests.current.isCurrent(requestId)) setGithubActivity(result.data || null);
    } catch (error) {
      if (githubActivityRequests.current.isCurrent(requestId)) setGithubActivityError(error.message || 'Não foi possível sincronizar a atividade do repositório.');
    } finally { if (githubActivityRequests.current.isCurrent(requestId)) setGithubActivityLoading(false); }
  };
  const connectHostinger = async (event) => {
    event.preventDefault(); if (localDemo) { setTestResult({ status: 'demo', message: 'Conexão de e-mail desativada na demonstração local.' }); return; } setTesting(true); setTestResult(null);
    try {
      const result = await apiRequest('/api/integrations/hostinger/configure', { method: 'POST', body: JSON.stringify({ email: hostingerEmail, password: hostingerPassword }) });
      setHostingerPassword(''); await refreshStatus();
      setTestResult({ status: 'connected', message: `Caixa conectada por IMAP e SMTP: ${result.data.accountEmail}.` });
    } catch (error) { setTestResult({ status: 'error', message: error.message || 'Nao foi possivel conectar a caixa postal.' }); await refreshStatus(); }
    finally { setTesting(false); }
  };
  const removeHostinger = async () => {
    if (localDemo) { notify('Alterações reais de integrações ficam desativadas na demonstração local.'); return; }
    if (!window.confirm('Remover a caixa postal e apagar a senha criptografada deste workspace?')) return;
    setTesting(true);
    try { await apiRequest('/api/integrations/hostinger/connection', { method: 'DELETE' }); await refreshStatus(); setHostingerEmail(''); setHostingerPassword(''); setTestResult(null); notify('Caixa postal Hostinger removida.'); }
    catch (error) { setTestResult({ status: 'error', message: error.message || 'Nao foi possivel remover a caixa postal.' }); }
    finally { setTesting(false); }
  };
  const authorizeGoogle = () => { if (localDemo) { notify('A autorização Google fica desativada na demonstração local.'); return; } window.location.assign('/api/integrations/google/authorize'); };
  const authorizeMercadoPago = () => { if (localDemo) { notify('A autorização Mercado Pago fica desativada na demonstração local.'); return; } window.location.assign('/api/integrations/mercadopago/authorize'); };
  const disconnectMercadoPago = async () => {
    if (localDemo) { notify('Alterações reais de integrações ficam desativadas na demonstração local.'); return; }
    if (!window.confirm('Desconectar a conta Mercado Pago deste workspace? As cobranças existentes continuam registradas, mas não poderão ser sincronizadas.')) return;
    setTesting(true); setTestResult(null);
    try {
      await apiRequest('/api/integrations/mercadopago/disconnect', { method: 'POST', body: '{}' });
      await refreshStatus();
      setTestResult({ status: 'disconnected', message: 'A autorização local foi removida e o Focusshub deixou de usar esta conta.' });
      notify('Conta Mercado Pago desconectada deste workspace.');
    } catch (error) { setTestResult({ status: 'error', message: error.message || 'Não foi possível desconectar a conta Mercado Pago.' }); }
    finally { setTesting(false); }
  };
  const disconnectGoogle = async () => {
    if (localDemo) { notify('Alterações reais de integrações ficam desativadas na demonstração local.'); return; }
    if (!window.confirm('Desconectar a conta Google? O Focusshub revogará o acesso e removerá os tokens salvos.')) return;
    setTesting(true); setTestResult(null);
    try {
      await apiRequest('/api/integrations/google/disconnect', { method: 'POST', body: '{}' });
      await refreshStatus();
      setTestResult({ status: 'disconnected', message: 'Conta Google desconectada e autorização revogada.' });
      notify('Conta Google desconectada.');
    } catch (error) { setTestResult({ status: 'error', message: error.message || 'Não foi possível desconectar a conta Google.' }); }
    finally { setTesting(false); }
  };
  const changeConnection = async (item, enabled) => {
    if (localDemo) { notify('Alterações reais de integrações ficam desativadas na demonstração local.'); return; }
    if (!enabled) {
      const details = item.name === 'WAHA'
        ? 'Isso pausa as sessões WhatsApp ativas. A chave continuará guardada no Coolify.'
        : 'O Focusshub deixará de usar esta integração. As credenciais continuarão guardadas no Coolify.';
      if (!window.confirm(`Desconectar ${item.name}? ${details}`)) return;
    }
    setChangingConnection(item.name);
    try {
      await apiRequest(`/api/integrations/${setup[item.name].provider}/connection`, { method: 'POST', body: JSON.stringify({ enabled }) });
      await refreshStatus();
      notify(enabled ? `${item.name} reativada no Focusshub. Teste a conexão para confirmar.` : `${item.name} desconectada do Focusshub.`);
    } catch (error) { notify(error.message || `Não foi possível ${enabled ? 'reativar' : 'desconectar'} ${item.name}.`); }
    finally { setChangingConnection(''); }
  };
  const connectionLabel = (item) => {
    const state = integrationStatus[item.name];
    if (state?.demo) return item.name === 'WAHA' ? 'Sessão simulada' : 'Indisponível na demonstração';
    const unavailableLabel = integrationStatusLabel(state, { loading: statusLoading, error: Boolean(statusFetchError) });
    if (unavailableLabel) return unavailableLabel;
    if (item.name === 'Mercado Pago' && state.oauthAvailable && !state.configured) return 'Autorização necessária';
    if (!state.configured) return 'Não configurada';
    if (!state.enabled) return 'Desconectada no Focusshub';
    if (item.name === 'Mercado Pago' && state.accountId) return `Vendedor autorizado · ${state.accountId}`;
    if (item.name === 'Mercado Pago' && state.oauthAvailable) return 'Autorização necessária';
    if (item.name === 'WAHA' && state.lastTestStatus === 'setup_required') return 'WhatsApp sem pareamento';
    if (item.name === 'Google Workspace' && state.accountEmail && state.lastTestStatus === 'setup_required') return `Ajustar acesso: ${state.accountEmail}`;
    if (item.name === 'Google Workspace' && state.accountEmail) return `Conectada: ${state.accountEmail}`;
    if (item.name === 'Google Workspace') return 'Autorização necessária';
    if (item.name === 'Hostinger E-mail' && state.accountEmail && state.lastTestStatus === 'error') return `Falha ao testar: ${state.accountEmail}`;
    if (item.name === 'Hostinger E-mail' && state.accountEmail && state.lastTestStatus === 'connected') return `Conectada: ${state.accountEmail}`;
    if (state.lastTestStatus === 'connected') return 'Conectada no último teste';
    if (state.lastTestStatus === 'setup_required') return 'Configuração incompleta';
    if (state.lastTestStatus === 'error') return 'Falha no último teste';
    return 'Credenciais configuradas · testar';
  };
  const connectionTone = (item) => integrationStatus[item.name]?.demo ? 'pending' : integrationStatusTone(integrationStatus[item.name], { loading: statusLoading, error: Boolean(statusFetchError) });
  const providerCategory = (name) => name === 'Mercado Pago' ? 'Pagamentos' : ['Evolution API', 'WAHA'].includes(name) ? 'WhatsApp' : ['Resend', 'Hostinger E-mail'].includes(name) ? 'E-mail' : name === 'Google Workspace' ? 'Produtividade' : name === 'Clicksign' ? 'Documentos' : name === 'GitHub' ? 'Desenvolvimento' : name === 'n8n' ? 'Automações' : 'Monitoramento';
  const visible = integrations.filter((item) => filter === 'Todas' || providerCategory(item.name) === filter);
  const exportIntegrationStatus = () => {
    const data = [['Serviço', 'Categoria', 'Configurado', 'Habilitado', 'Estado do teste', 'Testado em'], ...integrations.map((item) => {
      const state = integrationStatus[item.name] || {};
      const status = state.lastTestStatus === 'connected' ? 'Conectado' : state.lastTestStatus === 'setup_required' || state.lastTestStatus === 'not_configured' ? 'Configuração necessária' : state.lastTestStatus === 'disconnected' ? 'Desativado' : state.lastTestStatus ? 'Falha' : 'Sem teste';
      return [item.name, providerCategory(item.name), state.configured ? 'Sim' : 'Não', state.enabled ? 'Sim' : 'Não', status, state.testedAt || ''];
    })];
    downloadCsvFile(`integracoes-${localDateInput()}.csv`, rowsToCsv(data));
    notify('CSV do status das integrações exportado.');
  };
  const connectedCount = Object.values(integrationStatus).filter((item) => item?.configured && item?.enabled && item?.lastTestStatus === 'connected').length;
  const configuredCount = Object.values(integrationStatus).filter((item) => item?.configured).length;
  const googleReauthorization = googleReauthorizationButtonState(integrationStatus['Google Workspace'], statusLoading, Boolean(statusFetchError));
  const attentionCount = integrations.filter((provider) => {
    const state = integrationStatus[provider.name];
    return !state?.configured || !state?.enabled || state.lastTestStatus !== 'connected';
  }).length;
  return <>
    {localDemo && <div className="ns-info-note" role="status"><ShieldCheck size={17} /><span>Modo de demonstração ativo: os estados abaixo são simulados. Autorizações, testes e alterações reais ficam desativados.</span></div>}
    <section className="integration-overview" aria-label="Resumo das integrações"><div className="integration-overview-copy"><span className="integration-overview-icon"><Link2 size={19}/></span><div><span className="integration-eyebrow">CONEXÕES DO WORKSPACE</span><h2>Status da plataforma</h2><p>Conecte serviços e confira o estado reportado pela VPS. Segredos permanecem no servidor.</p></div><button className="ns-integration-refresh" type="button" onClick={() => refreshStatus()} disabled={statusLoading}><RefreshCw size={15} className={statusLoading ? 'ns-spinning' : ''}/>Atualizar status</button></div><div className="integration-overview-stats"><article><span>Conectadas</span><b>{statusLoading ? '—' : connectedCount}</b><small>confirmadas em teste</small></article><article><span>Configuradas</span><b>{statusLoading ? '—' : configuredCount}</b><small>com credenciais no servidor</small></article><article className={attentionCount ? 'has-attention' : ''}><span>Precisam de atenção</span><b>{statusLoading ? '—' : attentionCount}</b><small>sem conexão confirmada</small></article></div></section>
    {statusFetchError && <div className="dashboard-data-error" role="alert"><span>O status das integrações não foi confirmado. Autorização e testes ficam suspensos até a API responder. {statusFetchError}</span><button type="button" disabled={statusLoading} onClick={() => refreshStatus()}><RefreshCw size={14} className={statusLoading ? 'ns-spinning' : ''}/>Tentar novamente</button></div>}
    <div className="ns-integration-filters" role="group" aria-label="Filtrar integracoes">{categories.map((item) => <button type="button" aria-pressed={filter === item} className={filter === item ? 'active' : ''} key={item} onClick={() => setFilter(item)}>{item}</button>)}<button type="button" className="ns-secondary" onClick={exportIntegrationStatus} disabled={statusLoading}><Download size={14} />Exportar status</button></div>
    <div className="ns-integration-grid">{visible.map((item) => { const Icon = item.icon; const state = integrationStatus[item.name]; const tone = connectionTone(item); const mpAuthorization = mercadoPagoAuthorizationButtonState(state, statusLoading, Boolean(statusFetchError)); const testedAt = state?.testedAt ? new Date(state.testedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : ""; return <article className="ns-integration-card" key={item.name}><div className="ns-integration-top"><span className={`ns-integration-logo ${item.color}`}><Icon size={20} /></span><span className={`ns-connection-badge ${tone}`}><i />{connectionLabel(item)}</span></div><h3>{item.name}</h3><p>{item.detail}</p><small className="ns-integration-method">{integrationAuthSummary(item.name)}</small>{state?.testedAt && <small className="ns-integration-last-test" title={state.lastTestMessage || ""}>Último teste: {testedAt}</small>}<div className="ns-integration-actions">{item.name === 'WAHA' && <button type="button" className="ns-integration-configure" onClick={() => navigateTo('WhatsApp')}><Smartphone size={14} />Conectar número / QR Code</button>}{item.name === 'Google Workspace' && <button type="button" className="ns-integration-authorize" disabled={statusLoading || Boolean(statusFetchError) || (state?.configured && (!canAuthorizeOAuth || state?.enabled === false))} title={state?.configured && !canAuthorizeOAuth ? 'Somente a pessoa proprietaria pode autorizar integracoes.' : undefined} onClick={() => state?.configured ? authorizeGoogle() : (setConfiguring(item), setTestResult(null))}><Link2 size={14} />{state?.configured ? (state.accountEmail ? 'Reautorizar Google' : 'Autorizar Google') : 'Configurar OAuth'}</button>}{item.name === 'Mercado Pago' && <button type="button" className="ns-integration-authorize" disabled={mpAuthorization.disabled || (mpAuthorization.action === 'authorize' && !canAuthorizeOAuth)} title={mpAuthorization.action === 'authorize' && !canAuthorizeOAuth ? 'Somente a pessoa proprietaria pode autorizar integracoes.' : undefined} onClick={() => { if (mpAuthorization.action === 'authorize') authorizeMercadoPago(); else if (mpAuthorization.action === 'configure') { setConfiguring(item); setTestResult(null); } }}><Link2 size={14} />{mpAuthorization.label}</button>}<button className="ns-integration-configure" type="button" onClick={() => { setConfiguring(item); setTestResult(null); }}><Settings2 size={14} />{item.name === 'Hostinger E-mail' ? 'Conectar e-mail' : item.name === 'Google Workspace' || item.name === 'Mercado Pago' || state?.configured ? 'Configuração e teste' : 'Ver instruções'}</button>{state?.configured && <button className={`ns-integration-toggle ${state.enabled ? "disconnect" : "reconnect"}`} type="button" title={state.enabled ? 'As credenciais permanecem configuradas. WAHA pausa as sessões ao desativar.' : 'Reativa o uso no Focusshub; depois, teste a conexão.'} disabled={changingConnection === item.name || statusLoading} onClick={() => changeConnection(item, !state.enabled)}>{changingConnection === item.name ? <RefreshCw size={14} className="ns-spinning" /> : state.enabled ? <Unplug size={14} /> : <Check size={14} />}{state.enabled ? (item.name === 'WAHA' ? 'Pausar sessões' : 'Desativar uso') : 'Reativar uso'}</button>}</div></article>; })}</div>
    <div className="ns-info-note"><ShieldCheck size={17} /><span><b>Segurança:</b> tokens e chaves não são exibidos no navegador. Abra uma integração para ver as variáveis exigidas, testar a conexão e consultar a última resposta do provedor.</span></div>
    {configuring && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !testing) setConfiguring(null); }}><section className="ns-integration-modal" role="dialog" aria-modal="true" aria-labelledby="integration-dialog-title"><header><span className={`ns-integration-logo ${configuring.color}`}><configuring.icon size={18} /></span><div><h2 id="integration-dialog-title">{configuring.name}</h2><p>{configuring.name === 'Hostinger E-mail' ? (integrationStatus['Hostinger E-mail']?.configured ? 'Conta Hostinger conectada.' : 'Informe as credenciais da caixa postal para conectar.') : statusFetchError ? 'Status indisponível. Atualize para verificar a configuração antes de autorizar ou testar.' : integrationStatus[configuring.name]?.configured ? 'Credenciais detectadas no servidor.' : 'Credenciais ausentes. Configure as variáveis no Coolify para habilitar este serviço.'}</p></div><button type="button" aria-label="Fechar" onClick={() => !testing && setConfiguring(null)}><X size={17} /></button></header><div className="integration-setup-content">{configuring.name === 'Hostinger E-mail' ? <form className="ns-hostinger-setup" onSubmit={connectHostinger}><label>Endereço de e-mail<input type="email" required maxLength={254} autoComplete="username" value={hostingerEmail || integrationStatus['Hostinger E-mail']?.accountEmail || ''} onChange={(event) => setHostingerEmail(event.target.value)} placeholder="nome@seudominio.com.br" /></label><label>Senha da caixa postal<input type="password" required maxLength={256} autoComplete="current-password" value={hostingerPassword} onChange={(event) => setHostingerPassword(event.target.value)} /></label><small>Use os dados da caixa postal. A conexão é validada por IMAP com imap.hostinger.com:993 e SMTP seguro com smtp.hostinger.com:465.</small><button className="ns-primary" type="submit" disabled={testing || !hostingerEmail.trim() || !hostingerPassword}>{testing ? 'Validando conexão...' : 'Conectar e testar'}</button>{integrationStatus['Hostinger E-mail']?.configured && <button className="ns-secondary" type="button" disabled={testing} onClick={removeHostinger}>Remover caixa postal</button>}</form> : <><b>{integrationStatus[configuring.name]?.configured ? 'Variáveis utilizadas' : 'Variáveis necessárias'}</b><ul>{setup[configuring.name].vars.map((name) => <li key={name}><code>{name}</code></li>)}</ul><p>{setup[configuring.name].note}</p></>}{configuring.name !== 'Google Workspace' && configuring.name !== 'Mercado Pago' && configuring.name !== 'Hostinger E-mail' && <><div className="ns-integration-auth-method"><ShieldCheck size={15} /><span><b>Sem login por botão: configure no Coolify</b>Este serviço autentica com token/chave de API; o Focusshub não oferece OAuth para ele.</span></div><p className="ns-integration-credential-steps">No Coolify, abra a aplicação da API Focusshub, adicione exatamente as variáveis listadas acima em <b>Environment Variables</b>, salve e faça redeploy. Depois volte aqui, atualize o status e teste. Não cole tokens neste formulário nem no navegador.</p></>}{configuring.name === 'Mercado Pago' && <div className="ns-integration-modal-note ns-integration-google-state"><ShieldCheck size={15} /><span>{integrationStatus['Mercado Pago']?.accountId ? `Conta autorizada · vendedor ${integrationStatus['Mercado Pago'].accountId}. Tokens isolados neste workspace.` : integrationStatus['Mercado Pago']?.legacyAccount ? 'Credencial legada detectada neste servidor de workspace único; autorize por OAuth para migrar para tokens isolados.' : 'Nenhuma conta vendedora foi autorizada neste workspace.'}</span><p>Cadastre no Mercado Pago: {integrationStatus['Mercado Pago']?.oauthRedirectUri || window.location.origin + '/api/integrations/mercadopago/callback'}. Habilite PKCE (S256).</p>{!canAuthorizeOAuth && <p className="ns-oauth-owner-required">Somente a pessoa proprietaria do workspace pode autorizar ou trocar a conta.</p>}{integrationStatus['Mercado Pago']?.oauthAvailable ? <button type="button" className="ns-primary" disabled={!canAuthorizeOAuth || testing || statusLoading || Boolean(statusFetchError)} onClick={authorizeMercadoPago}>{integrationStatus['Mercado Pago']?.accountId ? 'Trocar ou reautorizar conta' : 'Autorizar Mercado Pago'}</button> : <p>Configure MERCADOPAGO_CLIENT_ID e MERCADOPAGO_CLIENT_SECRET no Coolify para habilitar OAuth.</p>}{integrationStatus['Mercado Pago']?.configured && <button type="button" className="ns-secondary" disabled={testing} onClick={disconnectMercadoPago}>Desconectar deste workspace</button>}</div>}{configuring.name === 'Google Workspace' && <div className="ns-integration-modal-note ns-integration-google-state"><ShieldCheck size={15} /><span>{integrationStatus['Google Workspace']?.accountEmail ? `Conta autorizada: ${integrationStatus['Google Workspace'].accountEmail}.` : integrationStatus['Google Workspace']?.configured ? 'Credenciais OAuth presentes; autorize a conta Google para concluir a conexão.' : 'Adicione GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no serviço API do Coolify antes de autorizar.'}</span><p>URI de redirecionamento: {integrationOAuthRedirectUri(integrationStatus['Google Workspace'], window.location.origin, 'google')}</p>{!canAuthorizeOAuth && <p className="ns-oauth-owner-required">Somente a pessoa proprietaria do workspace pode autorizar ou reautorizar a conta.</p>}{integrationStatus['Google Workspace']?.accountEmail ? <>{googleReauthorization.visible && <button type="button" className="ns-primary" disabled={!canAuthorizeOAuth || testing || googleReauthorization.disabled} onClick={authorizeGoogle}>{googleReauthorization.label}</button>}<button type="button" className="ns-secondary" disabled={testing} onClick={disconnectGoogle}>Desconectar conta Google</button></> : <button type="button" className="ns-primary" disabled={!canAuthorizeOAuth || testing || statusLoading || Boolean(statusFetchError) || !integrationStatus['Google Workspace']?.configured} onClick={authorizeGoogle}>Autorizar conta Google</button>}</div>}{configuring.name === 'GitHub' && <section className="ns-github-activity" aria-labelledby="github-activity-title"><div><h3 id="github-activity-title">Atividade do repositório</h3><p>Consulta somente leitura de commits recentes, pull requests abertas e último deploy.</p></div><form id="github-activity-form" className="ns-github-repo-controls" onSubmit={loadGithubActivity}><label>Proprietário<input required maxLength={39} autoComplete="off" value={githubOwner} onChange={(event) => { setGithubOwner(event.target.value); githubActivityRequests.current.invalidate(); setGithubActivityLoading(false); setGithubActivity(null); setGithubActivityError(''); }} placeholder="organização ou usuário" /></label><label>Repositório<input required maxLength={100} autoComplete="off" value={githubRepo} onChange={(event) => { setGithubRepo(event.target.value); githubActivityRequests.current.invalidate(); setGithubActivityLoading(false); setGithubActivity(null); setGithubActivityError(''); }} placeholder="nome-do-repositorio" /></label><button type="submit" className="ns-primary" disabled={githubActivityLoading || statusLoading}>{githubActivityLoading ? 'Consultando...' : githubActivity ? 'Atualizar atividade' : 'Consultar'}</button></form>{githubActivityError && <div className="dashboard-data-error" role="alert">{githubActivityError}<button type="submit" form="github-activity-form" disabled={githubActivityLoading}>Tentar novamente</button></div>}{githubActivity && <div className="ns-github-activity-result"><header><b>{githubActivity.repository?.fullName || githubOwner + '/' + githubRepo}</b>{githubActivity.repository?.url && <a href={githubActivity.repository.url} target="_blank" rel="noreferrer">Abrir no GitHub</a>}</header><small>{githubActivity.repository?.private ? 'Privado' : 'Público'} · branch {githubActivity.repository?.defaultBranch || 'main'} · sincronizado {githubActivity.syncedAt ? new Date(githubActivity.syncedAt).toLocaleString('pt-BR') : 'agora'}</small><div><b>Último commit</b>{githubActivity.latestCommit ? <a href={githubActivity.latestCommit.url} target="_blank" rel="noreferrer"><span>{githubActivity.latestCommit.message || githubActivity.latestCommit.sha}</span><small>{githubActivity.latestCommit.author} · {githubActivity.latestCommit.date ? new Date(githubActivity.latestCommit.date).toLocaleString('pt-BR') : ''}</small></a> : <p>Nenhum commit recente retornado.</p>}</div><div><b>Pull requests abertas ({githubActivity.pullRequests?.length || 0})</b>{githubActivity.pullRequests?.length ? <ul>{githubActivity.pullRequests.map((pull) => <li key={pull.number}><a href={pull.url} target="_blank" rel="noreferrer">#{pull.number} {pull.title}</a><small>{pull.author} · {pull.updatedAt ? new Date(pull.updatedAt).toLocaleDateString('pt-BR') : ''}</small></li>)}</ul> : <p>Nenhuma pull request aberta.</p>}</div><div><b>Último deploy</b>{githubActivity.deployment ? <p>{githubActivity.deployment.environment || 'Ambiente não informado'} · {githubActivity.deployment.state} · {githubActivity.deployment.createdAt ? new Date(githubActivity.deployment.createdAt).toLocaleString('pt-BR') : ''}{githubActivity.deployment.url && <> · <a href={githubActivity.deployment.url} target="_blank" rel="noreferrer">Abrir destino</a></>}</p> : <p>Nenhum deploy retornado.</p>}</div></div>}</section>}<div className="ns-integration-modal-note"><ShieldCheck size={15} />{configuring.name === 'Hostinger E-mail' ? 'A senha é recebida por HTTPS e armazenada criptografada no servidor deste workspace.' : configuring.name === 'Google Workspace' ? 'Os tokens OAuth são armazenados criptografados no servidor deste workspace e não são expostos ao navegador.' : configuring.name === 'Mercado Pago' ? 'O client secret OAuth permanece no servidor; os tokens da conta vendedora são criptografados por workspace.' : 'As chaves permanecem no Coolify e nunca são enviadas ao navegador.'}</div>{!testResult && integrationStatus[configuring.name]?.lastTestMessage && <div className={`integration-test-result ${integrationStatus[configuring.name].lastTestStatus || 'error'}`} role="status"><span>{integrationStatus[configuring.name].lastTestStatus === 'connected' ? 'Conexão confirmada' : integrationStatus[configuring.name].lastTestStatus === 'setup_required' || integrationStatus[configuring.name].lastTestStatus === 'not_configured' ? 'Ação necessária' : integrationStatus[configuring.name].lastTestStatus === 'disconnected' ? 'Integração desativada' : 'Falha no último teste'}</span><p>{integrationStatus[configuring.name].lastTestMessage}</p></div>}{testResult && <div className={`integration-test-result ${testResult.status}`} role="status"><span>{testResult.status === 'connected' ? 'Conexão confirmada' : testResult.status === 'setup_required' ? 'Integração ainda incompleta' : testResult.status === 'disconnected' ? 'Integração desativada' : 'Teste sem sucesso'}</span><p>{testResult.message}</p></div>}{<section className="ns-integration-test-history" aria-label="Hist&#243;rico de testes">{testHistoryError && <div className="dashboard-data-error" role="alert">{testHistoryError}<button type="button" onClick={() => loadTestHistory(setup[configuring.name]?.provider)}>Tentar novamente</button></div>}<div><b>Hist&#243;rico recente</b><small>{testHistoryLoading ? 'Carregando...' : `${testHistory.length} registro(s)`}</small></div>{testHistory.length ? <ol>{testHistory.map((entry) => <li key={entry.id}><span className={`history-status ${entry.status}`} />{entry.status === 'connected' ? 'Conectado' : entry.status === 'setup_required' || entry.status === 'not_configured' ? 'Configura&#231;&#227;o pendente' : entry.status === 'disconnected' ? 'Desativado' : 'Falha'}<time>{new Date(entry.createdAt).toLocaleString('pt-BR')}</time></li>)}</ol> : !testHistoryLoading && !testHistoryError && <p>Nenhum teste persistido ainda.</p>}</section>}</div><footer><button type="button" className="ns-secondary" onClick={() => refreshStatus()} disabled={statusLoading}><RefreshCw size={14} />Atualizar status</button><button type="button" className="ns-primary" onClick={testConnection} disabled={testing || statusLoading || Boolean(statusFetchError) || (['Google Workspace', 'Hostinger E-mail'].includes(configuring.name) && !integrationStatus[configuring.name]?.accountEmail)} title={['Google Workspace', 'Hostinger E-mail'].includes(configuring.name) && !integrationStatus[configuring.name]?.accountEmail ? (configuring.name === 'Google Workspace' ? 'Autorize a conta Google antes de testar.' : 'Conecte a caixa postal antes de testar.') : undefined}><Check size={14} />{testing ? 'Testando…' : ['Google Workspace', 'Hostinger E-mail'].includes(configuring.name) && !integrationStatus[configuring.name]?.accountEmail ? (configuring.name === 'Google Workspace' ? 'Autorize primeiro' : 'Conecte primeiro') : integrationStatus[configuring.name]?.testedAt ? 'Testar novamente' : 'Testar conexão'}</button></footer></section></div>}
  </>;
}

function WahaSessions({ notify }) {
  const currentRole = (() => { try { return JSON.parse(sessionStorage.getItem('nexo.api.user') || 'null')?.role || ''; } catch { return ''; } })();
  const canManageSessions = canManageWahaSessions(currentRole);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [selected, setSelected] = useState(null);
  const [qr, setQr] = useState('');
  const [qrError, setQrError] = useState('');
  const [qrLoading, setQrLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [error, setError] = useState('');
  const sessionRefreshLock = useRef(null);
  const sessionRefreshMounted = useRef(false);
  if (!sessionRefreshLock.current) sessionRefreshLock.current = createAsyncActionLock();
  const qrRequests = useRef(null);
  if (!qrRequests.current) qrRequests.current = createLatestRequestGuard();
  const selectedSession = sessions.find((item) => item.id === selected);
  const refresh = async ({ clearError = false } = {}) => sessionRefreshLock.current.run(async () => {
    try {
      const result = await apiRequest('/api/integrations/waha/sessions');
      if (!sessionRefreshMounted.current) return;
      const nextSessions = Array.isArray(result.data) ? result.data : [];
      setSessions(nextSessions);
      setSelected((current) => {
        if (!canManageSessions) return null;
        return current && nextSessions.some((item) => item.id === current)
          ? current
          : nextSessions.find((item) => item.status === 'SCAN_QR_CODE')?.id || null;
      });
      if (clearError) setError('');
    }
    catch (err) { if (sessionRefreshMounted.current) setError(err.message || 'Falha ao carregar as sessões WAHA.'); }
    finally { if (sessionRefreshMounted.current) setLoading(false); }
  });
  const refreshManually = async () => {
    setManualRefreshing(true);
    try { await refresh({ clearError: true }); }
    finally { setManualRefreshing(false); }
  };
  useEffect(() => {
    sessionRefreshMounted.current = true;
    const timer = window.setInterval(() => { void refresh(); }, 5000);
    void refresh();
    return () => { sessionRefreshMounted.current = false; window.clearInterval(timer); };
  }, []);
  const loadQr = async (id) => {
    if (!canShowWahaQr(currentRole, sessions.find((item) => item.id === id)?.status)) return;
    const requestId = qrRequests.current.begin();
    if (sessions.find((item) => item.id === id)?.status !== 'SCAN_QR_CODE') { setQr(''); setQrError(''); setQrLoading(false); return; }
    setQrLoading(true);
    try { const result = await apiRequest(`/api/integrations/waha/sessions/${encodeURIComponent(id)}/qr`); if (!qrRequests.current.isCurrent(requestId)) return; setQr(result.data?.image ? `data:${result.data.mimetype};base64,${result.data.image}` : ''); setQrError(result.data?.image ? '' : 'A sessão ainda não disponibilizou o QR Code. Atualize em alguns segundos.'); }
    catch (err) { if (qrRequests.current.isCurrent(requestId)) { setQr(''); setQrError(err.message || 'Não foi possível carregar o QR Code. Tente novamente.'); } }
    finally { if (qrRequests.current.isCurrent(requestId)) setQrLoading(false); }
  };
  useEffect(() => {
    if (!selected) { qrRequests.current.invalidate(); setQr(''); setQrError(''); return undefined; }
    if (selectedSession?.status !== 'SCAN_QR_CODE') { qrRequests.current.invalidate(); setQr(''); setQrError(''); return undefined; }
    loadQr(selected);
    const timer = window.setInterval(() => loadQr(selected), 12000);
    return () => { window.clearInterval(timer); qrRequests.current.invalidate(); };
  }, [selected, selectedSession?.status]);
  const createSession = async (event) => {
    event.preventDefault(); if (!canManageSessions) { notify('Somente a pessoa proprietária pode adicionar ou reconectar números WhatsApp.'); return; } if (!label.trim()) return;
    setBusy(true);
    try { const result = await apiRequest('/api/integrations/waha/sessions', { method: 'POST', body: JSON.stringify({ label: label.trim() }) }); setSessions((items) => [result.data, ...items]); setSelected(result.data.id); setQr(''); setNewOpen(false); setLabel(''); notify('Sessão criada. Escaneie o QR Code pelo WhatsApp do celular.'); }
    catch (err) { setError(err.message || 'Não foi possível criar a sessão WAHA.'); }
    finally { setBusy(false); }
  };
  const perform = async (item, action) => {
    if (!canManageSessions) { notify('Somente a pessoa proprietária pode gerenciar sessões WhatsApp.'); return; }
    if (action === 'delete' && !window.confirm(`Apagar a conexão “${item.label}”? Isso desconecta o WhatsApp e remove esta sessão do servidor.`)) return;
    if (action === 'logout' && !window.confirm(`Desconectar “${item.label}”? Será necessário ler um novo QR Code para conectar novamente.`)) return;
    setBusy(true); setError('');
    try {
      if (action === 'delete') { await apiRequest(`/api/integrations/waha/sessions/${item.id}`, { method: 'DELETE' }); setSessions((rows) => rows.filter((row) => row.id !== item.id)); if (selected === item.id) { setSelected(null); setQr(''); } notify('Sessão apagada.'); }
      else { await apiRequest(`/api/integrations/waha/sessions/${item.id}/${action}`, { method: 'POST', body: '{}' }); if (['start', 'restart', 'logout'].includes(action)) { setSelected(item.id); setQr(''); setQrError(''); } await refresh({ clearError: true }); notify(action === 'stop' ? 'Sessão pausada; o vínculo do celular foi preservado.' : action === 'logout' ? 'WhatsApp desconectado. Leia o novo QR para vincular novamente.' : 'Sessão WAHA atualizada.'); }
    } catch (err) { setError(err.message || 'A WAHA não concluiu esta ação.'); }
    finally { setBusy(false); }
  };
  const statusLabel = (status) => ({ WORKING: 'Conectado', SCAN_QR_CODE: 'Aguardando QR Code', STARTING: 'Iniciando', STOPPED: 'Pausado', FAILED: 'Falhou', NOT_FOUND: 'Sessão não encontrada' }[status] || status || 'Status desconhecido');
  const exportSessions = () => {
    const data = [['Nome', 'Número', 'Status', 'Motor', 'Atualizado'], ...sessions.map((item) => [item.label, item.number || '', statusLabel(item.status), item.engine || '', item.updatedAt || ''])];
    downloadCsvFile(`whatsapp-sessoes-${localDateInput()}.csv`, rowsToCsv(data));
    notify('CSV das sessões exportado.');
  };
  const connected = sessions.filter((item) => item.status === 'WORKING').length;
  return <>{!canManageSessions && <div className="ns-info-note" role="status"><ShieldCheck size={16} /><span>Somente a pessoa propriet&aacute;ria pode adicionar, parear, pausar ou reconectar n&uacute;meros. Voc&ecirc; ainda pode consultar sess&otilde;es e atender conversas j&aacute; conectadas.</span></div>}
    <div className="ns-metrics ns-metrics-three"><Metric label="Números cadastrados" value={String(sessions.length)} note="Sessões neste workspace" icon={Smartphone} /><Metric label="Conectados" value={String(connected)} note={connected > 0 ? 'WhatsApp pronto para uso' : 'Nenhum número ativo'} icon={MessageCircle} /><Metric label="Precisam de ação" value={String(sessions.filter((item) => item.status !== 'WORKING').length)} note="QR, pausa ou reconexão" icon={AlertCircle} /></div>
    <div className="ns-section-heading"><div><h2>Conexões WhatsApp</h2><p>Adicione vários números, conecte pelo QR e controle cada sessão.</p></div><div className="ns-support-actions"><button className="ns-secondary" type="button" onClick={exportSessions} disabled={!sessions.length}><Download size={14} />Exportar CSV</button><button className="ns-secondary" type="button" onClick={refreshManually} disabled={manualRefreshing}><RefreshCw size={14} className={manualRefreshing ? 'ns-spinning' : ''} />{manualRefreshing ? 'Atualizando…' : 'Atualizar'}</button><button className="ns-primary" type="button" onClick={() => setNewOpen(true)} disabled={!canManageSessions} title={!canManageSessions ? 'Somente a pessoa proprietária pode adicionar números.' : undefined}><Plus size={15} />Adicionar número</button></div></div>
    {error && <div className="dashboard-data-error" role="alert"><span>{error}</span><button type="button" onClick={refreshManually} disabled={manualRefreshing}><RefreshCw size={14} className={manualRefreshing ? 'ns-spinning' : ''} />Tentar novamente</button><button type="button" onClick={() => setError('')} aria-label="Fechar">×</button></div>}
    {loading ? <div className="ns-empty-history">Carregando sessões do servidor…</div> : sessions.length === 0 ? <div className="ns-empty-history">Nenhum número conectado. Adicione um para gerar o primeiro QR Code.</div> : <div className="ns-integration-grid">{sessions.map((item) => <article className="ns-integration-card" key={item.id}><div className="ns-integration-top"><span className="ns-integration-logo whatsapp"><Smartphone size={20} /></span><span className={`ns-connection-badge ${item.status === 'WORKING' ? 'configured' : ''}`}><i />{statusLabel(item.status)}</span></div><h3>{item.label}</h3><p>{item.number || 'Número aparecerá depois da leitura do QR Code'} · {item.engine}</p><div className="ns-integration-actions">{canOfferWahaConnectAction(item.status) && <button type="button" disabled={!canManageSessions || busy} onClick={() => { setSelected(item.id); setQr(''); setQrError(''); if (item.status === 'FAILED') perform(item, 'restart'); else if (item.status === 'NOT_FOUND') perform(item, 'start'); }}><Smartphone size={14} />{item.status === 'STARTING' ? 'Iniciando sessão…' : selected === item.id && qr ? 'QR Code aberto' : item.status === 'FAILED' ? 'Gerar novo QR Code' : 'Conectar / QR Code'}</button>}{item.status === 'WORKING' ? <button type="button" disabled={!canManageSessions || busy} onClick={() => perform(item, 'stop')}>Pausar</button> : item.status === 'STOPPED' && <button type="button" disabled={!canManageSessions || busy} onClick={() => perform(item, 'start')}>Retomar</button>}{item.status === 'WORKING' && <button type="button" disabled={!canManageSessions || busy} onClick={() => perform(item, 'logout')}>Desconectar</button>}<button type="button" className="ns-link-button danger" disabled={!canManageSessions || busy} onClick={() => perform(item, 'delete')}><Trash2 size={14} />Apagar</button></div>{selected === item.id && item.status !== 'WORKING' && <div className="ns-waha-qr" role="status" aria-live="polite">{qrError ? <><span className="ns-waha-qr-error" role="alert">{qrError}</span><button className="ns-secondary" type="button" disabled={!canManageSessions || qrLoading} onClick={() => loadQr(item.id)}><RefreshCw size={14} className={qrLoading ? 'ns-spinning' : ''} />{qrLoading ? 'Tentando novamente...' : 'Tentar carregar QR novamente'}</button></> : qrLoading && !qr ? <span>Carregando QR Code…</span> : qr ? <img width={280} height={280} src={qr} alt={`QR Code de conexão para ${item.label}`} /> : <span>{wahaQrSessionMessage(item.status)}</span>}<small>WhatsApp no celular → Dispositivos conectados → Conectar dispositivo</small></div>}</article>)}</div>}
    <div className="ns-info-note"><ShieldCheck size={17} /><span>“Pausar” mantém o vínculo salvo. “Desconectar” encerra o vínculo do WhatsApp e pede nova leitura do QR. “Apagar” remove a sessão e seus dados no WAHA.</span></div>
    {newOpen && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) setNewOpen(false); }}><form className="ns-integration-modal" role="dialog" aria-modal="true" aria-labelledby="waha-create-title" aria-busy={busy} onSubmit={createSession}><header><span className="ns-integration-logo whatsapp"><Smartphone size={18} /></span><div><h2 id="waha-create-title">Adicionar número WhatsApp</h2><p>Cria uma sessão independente para este número.</p></div><button type="button" aria-label="Fechar" disabled={!canManageSessions || busy} onClick={() => { setNewOpen(false); setLabel(''); }}><X size={17} /></button></header><div className="ns-integration-fields"><label>Nome para identificar o número<input autoFocus required minLength="2" maxLength="80" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ex.: Comercial FocussDev" /></label></div><div className="ns-integration-modal-note"><ShieldCheck size={15} />Após criar, o QR Code será gerado aqui. Cada número usa uma sessão WAHA independente.</div><footer><button type="button" className="ns-secondary" disabled={!canManageSessions || busy} onClick={() => { setNewOpen(false); setLabel(''); }}>Cancelar</button><button type="submit" className="ns-primary" disabled={!canManageSessions || busy}><Plus size={14} />{busy ? 'Criando…' : 'Criar e gerar QR'}</button></footer></form></div>}
  </>;
}
const automationTemplates = [
  { id: 'new-lead-follow-up', name: 'Acompanhar lead novo', detail: 'Cria uma tarefa para responder e qualificar o contato.', trigger: 'Novo lead recebido', action: 'Criar tarefa de follow-up', systems: 'CRM + Tarefas' },
  { id: 'proposal-accepted-project', name: 'Preparar projeto vendido', detail: 'Ao aceitar a proposta, cria uma tarefa para iniciar o projeto e conferir o escopo.', trigger: 'Proposta aceita', action: 'Criar tarefa de início do projeto', systems: 'Propostas + Tarefas' },
  { id: 'payment-confirmed', name: 'Acompanhar pagamento confirmado', detail: 'O Mercado Pago atualiza a cobrança; este fluxo cria uma tarefa para a equipe revisar o recebimento.', trigger: 'Pagamento confirmado', action: 'Criar tarefa de conferência', systems: 'Mercado Pago + Tarefas' },
  { id: 'overdue-payment-reminder', name: 'Revisar cobrança vencida', detail: 'Quando uma cobrança pendente ultrapassar o vencimento, cria uma tarefa interna para conferir o pagamento no Mercado Pago e decidir se deve emitir uma nova cobrança. Não envia mensagens ao cliente.', trigger: 'Cobrança pendente vencida', action: 'Criar tarefa interna de revisão', systems: 'Financeiro + Tarefas + n8n' },
  { id: 'project-delivery-follow-up', name: 'Acompanhar entrega', detail: 'Cria um retorno alguns dias depois da publica\u00e7\u00e3o do projeto.', trigger: 'Projeto publicado', action: 'Criar tarefa de acompanhamento', systems: 'Projetos + Tarefas' },
  { id: 'new-support-ticket', name: 'Atender novo chamado', detail: 'Cria uma tarefa para a equipe tratar o pedido de suporte recebido.', trigger: 'Novo ticket criado', action: 'Criar tarefa de atendimento', systems: 'Atendimento + Tarefas' },
];
const n8nSupportedTemplateIds = new Set(['new-lead-follow-up', 'proposal-accepted-project', 'payment-confirmed', 'overdue-payment-reminder', 'project-delivery-follow-up', 'new-support-ticket']);

function Automations({ notify }) {
  const preferences = useWorkspacePreferences();
  const localDemo = isLocalDemoActive();
  const { records: items, loading, error, refresh, create, update, remove: deleteRecord } = useWorkspaceRecords('automations');
  const [n8nData, setN8nData] = useState(null);
  const [deliveryHistory, setDeliveryHistory] = useState([]);
  const [deliveryError, setDeliveryError] = useState('');
  const [deliveryActionErrors, setDeliveryActionErrors] = useState({});
  const [n8nError, setN8nError] = useState('');
  const [n8nSetupRequired, setN8nSetupRequired] = useState(false);
  const [n8nLoading, setN8nLoading] = useState(false);
  const [n8nMoreLoading, setN8nMoreLoading] = useState(false);
  const [form, setForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState('');
  const [formError, setFormError] = useState('');
  const [draft, setDraft] = useState({ name: '', detail: '', trigger: 'Novo lead recebido', action: 'Criar tarefa de follow-up' });
  const triggers = [...new Set(automationTemplates.map((item) => item.trigger))];
  const actions = automationActionOptions(draft.trigger, draft.action, automationTemplates);
  const refreshN8n = useCallback(async () => {
    setN8nLoading(true);
    const [workflowResult, deliveryResult] = await Promise.allSettled([
      apiRequest('/api/integrations/n8n/workflows'),
      apiRequest('/api/integrations/n8n/deliveries'),
    ]);
    if (deliveryResult.status === 'fulfilled') { setDeliveryHistory(Array.isArray(deliveryResult.value.data) ? deliveryResult.value.data : []); setDeliveryError(''); }
    else { setDeliveryHistory([]); setDeliveryError(deliveryResult.reason?.message || 'Falha ao consultar a fila de entregas.'); }
    if (workflowResult.status === 'fulfilled') {
      const data = workflowResult.value.data;
      if (Array.isArray(data?.workflows) && Array.isArray(data?.executions)) {
        setN8nData({ ...data, deliveryQueue: data.deliveryQueue || null });
        setN8nError('');
        setN8nSetupRequired(false);
      } else {
        setN8nData(null);
        setN8nError('Conecte o n8n em Integrações para consultar workflows e execuções.');
        setN8nSetupRequired(true);
      }
    } else { setN8nData(null); setN8nError(workflowResult.reason?.message || 'Falha ao consultar o n8n.'); setN8nSetupRequired(n8nSetupActionRequired(workflowResult.reason?.code)); }
    setN8nLoading(false);
  }, []);;
  useEffect(() => { refreshN8n(); }, [refreshN8n]);
  const loadMoreN8nWorkflows = async () => {
    const cursor = n8nData?.workflowNextCursor;
    if (!cursor || n8nLoading || n8nMoreLoading) return;
    setN8nMoreLoading(true);
    try {
      const result = await apiRequest(`/api/integrations/n8n/workflows?cursor=${encodeURIComponent(cursor)}`);
      const page = result.data;
      setN8nData((current) => {
        if (!current) return page;
        return { ...current, ...page, workflows: appendUniqueN8nWorkflows(current.workflows, page.workflows) };
      });
    } catch (err) {
      notify(err.message || 'Não foi possível carregar mais workflows.');
    } finally { setN8nMoreLoading(false); }
  };
  const operateDelivery = async (delivery, action) => {
    if (action === 'retry' && !window.confirm(`Reprocessar “${delivery.automationName}”? O evento será reenviado ao n8n e pode criar tarefas no workspace.`)) return;
    if (action === 'discard' && !window.confirm('Descartar este evento pendente e apagar os dados guardados para a entrega?')) return;
    setBusy('delivery:' + delivery.id);
    setDeliveryActionErrors((current) => ({ ...current, [delivery.id]: '' }));
    try {
      await apiRequest('/api/integrations/n8n/deliveries/' + encodeURIComponent(delivery.id) + '/' + action, { method: 'POST', body: '{}' });
      await refreshN8n();
      notify(action === 'retry' ? 'Evento recolocado na fila.' : 'Evento descartado e dados apagados.');
    } catch (err) { setDeliveryActionErrors((current) => ({ ...current, [delivery.id]: { action, message: err.message || 'Não foi possível atualizar esta entrega.' } })); }
    finally { setBusy(''); }
  };
  const changeN8nWorkflow = async (workflow) => {
    const action = workflow.active ? 'unpublish' : 'publish';
    const message = action === 'publish'
      ? `Publicar “${workflow.name}” no n8n? O workflow poderá receber os eventos correspondentes do Focusshub e criar tarefas.`
      : `Despublicar “${workflow.name}” no n8n? Novos eventos deixarão de acionar este workflow.`;
    if (!window.confirm(message)) return;
    setBusy(`n8n:${workflow.id}`);
    try {
      await apiRequest(`/api/integrations/n8n/workflows/${encodeURIComponent(workflow.id)}/${action}`, { method: 'POST', body: '{}' });
      await Promise.all([refresh(), refreshN8n()]);
      notify(action === 'publish' ? 'Workflow publicado e confirmado pelo n8n.' : 'Workflow despublicado e confirmado pelo n8n.');
    } catch (err) { notify(err.message || 'O n8n não confirmou a alteração do workflow.'); }
    finally { setBusy(''); }
  };
  const createN8nWorkflow = async (item) => {
    if (!n8nData || n8nLoading) { notify('Atualize o n8n e confirme a conexão antes de criar um workflow.'); return; }
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
  const openNew = () => { setEditing(null); setFormError(''); setDraft({ name: '', detail: '', trigger: triggers[0], action: defaultAutomationAction(triggers[0], automationTemplates) }); setForm(true); };
  const openEdit = (item) => {
    setFormError('');
    if (item.n8nWorkflowId) { notify('Este fluxo já foi criado no n8n. Edite os gatilhos e as ações lá para manter o Focusshub sincronizado.'); return; }
    setEditing(item.id); setDraft(automationDraftForEdit(item, triggers[0], automationTemplates)); setForm(true);
  };
  const saveDraft = async (event) => {
    event.preventDefault();
    if (!draft.name.trim()) { notify('Informe um nome para a automacao.'); return; }
    setBusy('save');
    setFormError('');
    const data = { ...draft, name: draft.name.trim(), detail: draft.detail.trim(), active: false, status: 'draft' };
    try {
      if (editing) await update(editing, data); else await create(data);
      setForm(false); notify(editing ? 'Rascunho atualizado.' : 'Automacao salva como rascunho.');
    } catch (err) { setFormError(err.message || 'Não foi possível salvar a automação. Seus dados continuam no formulário.'); }
    finally { setBusy(''); }
  };
  const remove = async (item) => {
    const message = item.n8nWorkflowId
      ? `Remover “${item.name}” do Focusshub? O workflow remoto ${item.active ? 'permanecerá publicado' : 'permanecerá no n8n como rascunho'}; despublique ou remova-o também no n8n se não for mais necessário.`
      : `Excluir o rascunho local “${item.name}”?`;
    if (item.n8nWorkflowId ? !window.confirm(message) : !confirmWorkspaceDelete(message, preferences)) return;
    setBusy(`delete:${item.id}`);
    try { await deleteRecord(item.id); notify(item.n8nWorkflowId ? 'Vínculo removido do Focusshub. Revise o workflow remoto no n8n.' : 'Rascunho removido.'); }
    catch (err) { notify(err.message || 'Não foi possível remover este rascunho.'); }
    finally { setBusy(''); }
  };
  const availableTemplates = automationTemplates.filter((template) => !items.some((item) => item.templateId === template.id));
  const exportAutomationHistory = () => {
    const data = [['Tipo', 'Nome', 'Evento', 'Estado', 'Tentativas', 'Atualizado'],
      ...deliveryHistory.map((entry) => ['Entrega', entry.automationName || '', entry.eventKey || '', entry.status || '', entry.attempts ?? '', entry.createdAt || '']),
      ...(n8nData?.workflows || []).map((workflow) => ['Workflow', workflow.name || '', `${workflow.triggerCount || 0} gatilhos`, workflow.active ? 'Publicado' : 'Rascunho', '', workflow.updatedAt || '']),
      ...(n8nData?.executions || []).map((run) => ['Execução', run.workflowName || '', '', run.status || '', '', run.startedAt || ''])];
    downloadCsvFile(`automacoes-historico-${localDateInput()}.csv`, rowsToCsv(data));
    notify('CSV do histórico de automações exportado.');
  };
  return <>
    <div className="ns-metrics ns-metrics-three"><Metric label="Workflows carregados" value={n8nData ? String(n8nData.workflows.length) : '—'} note={n8nData ? `${n8nData.workflows.filter((workflow) => workflow.active).length} publicados` : 'Aguardando conexão real'} icon={Sparkles} /><Metric label="Execuções recentes" value={n8nData ? String(n8nData.executions.length) : '—'} note="Histórico consultado no n8n" icon={Activity} /><Metric label="Modelos do workspace" value={String(items.length)} note="Configurações salvas neste app" icon={Clock3} /></div>
    {n8nData?.deliveryQueue && <section className="ns-delivery-queue" aria-label="Estado da fila de eventos n8n"><div><span className="ns-queue-pulse" /><b>Entrega de eventos</b><small>Fila protegida contra perda e duplicidade</small></div><span><strong>{n8nData.deliveryQueue.pending}</strong> aguardando</span><span><strong>{n8nData.deliveryQueue.delivered}</strong> entregues</span><span className={n8nData.deliveryQueue.discarded ? 'has-failures' : ''}><strong>{n8nData.deliveryQueue.discarded}</strong> descartados</span></section>}
    <section className="ns-automation-history" aria-label="Hist&#243;rico de entregas n8n"><div className="ns-section-heading"><div><h2>Hist&#243;rico de entregas</h2><p>&#218;ltimos 50 eventos. Payloads ficam ocultos; descarte apaga os dados e libera reten&#231;&#227;o.</p></div><button type="button" className="ns-secondary" onClick={exportAutomationHistory} disabled={!deliveryHistory.length && !n8nData?.workflows?.length && !n8nData?.executions?.length}><Download size={14} />Exportar histórico</button></div>{deliveryError && <div className="dashboard-data-error" role="alert">{deliveryError}<button type="button" onClick={refreshN8n} disabled={n8nLoading}>Tentar novamente</button></div>}{deliveryHistory.length ? deliveryHistory.map((delivery) => <article className="ns-automation-row ns-delivery-row" key={delivery.id}><span className="ns-flow-main"><b>{delivery.automationName}</b><small>{delivery.eventKey} | tentativas: {delivery.attempts} | {new Date(delivery.createdAt).toLocaleString('pt-BR')}</small>{delivery.lastError && <small>Falha: {delivery.lastError}</small>}</span><span className={delivery.status === 'discarded' ? 'ns-automation-status' : 'ns-automation-status ' + (delivery.status === 'delivered' ? 'is-active' : '')}>{delivery.status === 'delivered' ? 'Entregue' : delivery.status === 'discarded' ? 'Descartado' : 'Pendente'}</span>{delivery.retryable && <button type="button" className="ns-secondary" disabled={busy === 'delivery:' + delivery.id} onClick={() => operateDelivery(delivery, 'retry')}>Reprocessar</button>}{delivery.status === 'pending' && <button type="button" className="ns-secondary" disabled={busy === 'delivery:' + delivery.id} onClick={() => operateDelivery(delivery, 'discard')}>Descartar</button>}{deliveryActionErrors[delivery.id]?.message && <div className="dashboard-data-error ns-delivery-action-error" role="alert">{deliveryActionErrors[delivery.id].message}<button type="button" disabled={busy === 'delivery:' + delivery.id} onClick={() => operateDelivery(delivery, deliveryActionErrors[delivery.id].action)}>Tentar novamente</button></div>}</article> ) : deliveryError ? null : <div className="ns-empty-history">Nenhuma entrega registrada.</div>}</section>
    <section className="ns-automation-history" aria-labelledby="n8n-workflows-title">
      <div className="ns-section-heading"><div><h2 id="n8n-workflows-title">Workflows reais do n8n</h2><p>Estado e execuções vêm da API do n8n. Publicar/despublicar altera o workflow remoto.</p></div><button type="button" className="ns-secondary" onClick={refreshN8n} disabled={n8nLoading}><RefreshCw size={14} />{n8nLoading ? 'Atualizando...' : 'Atualizar n8n'}</button></div>
      {n8nError && <div className={`ns-automation-connection-alert ${n8nSetupRequired ? 'setup-required' : 'connection-failed'}`} role={n8nSetupRequired ? 'note' : 'alert'}><ShieldCheck size={16} /><span>{n8nError}</span>{n8nSetupRequired && <button type="button" className="ns-secondary" onClick={() => window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Integrações' }))}>Abrir integrações</button>}</div>}
      {n8nLoading && !n8nData && <div className="ns-empty-history">Consultando workflows e execuções no servidor...</div>}
      {n8nData && n8nData.workflows.length === 0 && <div className="ns-empty-history">A API conectou, mas ainda não há workflows no n8n.</div>}
      {n8nData?.workflows.map((workflow) => <article className="ns-automation-row ns-n8n-workflow-row" key={workflow.id}><span className="ns-flow-icon"><Sparkles size={18} /></span><span className="ns-flow-main"><b>{workflow.name || 'Workflow sem nome'}</b><small>{workflow.triggerCount} gatilho(s) · atualizado {workflow.updatedAt ? new Date(workflow.updatedAt).toLocaleString('pt-BR') : 'sem data'}</small></span><span className={`ns-automation-status ${workflow.active ? 'is-active' : ''}`}>{workflow.active ? 'Publicado' : 'Rascunho'}</span><button type="button" className={workflow.active ? 'ns-secondary' : 'ns-primary'} disabled={busy === `n8n:${workflow.id}`} onClick={() => changeN8nWorkflow(workflow)}>{busy === `n8n:${workflow.id}` ? 'Salvando...' : workflow.active ? 'Despublicar' : 'Publicar'}</button></article>)}
      {n8nData?.workflowNextCursor && <div className="ns-automation-load-more"><button type="button" className="ns-secondary" onClick={loadMoreN8nWorkflows} disabled={n8nMoreLoading || n8nLoading}>{n8nMoreLoading ? 'Carregando workflows...' : 'Carregar mais workflows'}</button></div>}
      <div className="ns-section-heading ns-n8n-executions-heading"><div><h2>Execuções recentes</h2><p>Os dados de entrada/saída não são carregados para proteger informações de clientes.</p></div></div>
      {n8nData?.executions.map((run) => { const state = String(run.status || 'unknown'); const Icon = state === 'success' ? CheckCircle2 : ['error', 'crashed'].includes(state) ? AlertCircle : Clock3; return <div className="ns-run-row" key={run.id}><Icon size={15} /><span><b>{run.workflowName}</b> · {state}</span><small>{run.startedAt ? new Date(run.startedAt).toLocaleString('pt-BR') : 'Aguardando execução'}</small></div>; })}
      {n8nData && n8nData.executions.length === 0 && <div className="ns-empty-history">Nenhuma execução recente registrada no n8n.</div>}
    </section>
    <div className="ns-section-heading"><div><h2>Modelos do workspace</h2><p>Modelos compatíveis podem ser criados e publicados no n8n; modelos personalizados permanecem como rascunhos locais.</p></div><button type="button" className="ns-primary" onClick={openNew}><Plus size={15} />Criar rascunho</button></div>
    {loading && <div className="ns-empty-history">Carregando fluxos salvos...</div>}
    {error && <div className="dashboard-data-error" role="alert">{error}<button type="button" onClick={refresh}>Tentar novamente</button></div>}
    {!loading && items.length > 0 && <div className="ns-automation-list">{items.map((item) => { const linked = Boolean(item.n8nWorkflowId); const supported = n8nSupportedTemplateIds.has(item.templateId); return <article className="ns-automation-row" key={item.id}><span className={`ns-flow-icon${item.active ? ' active' : ''}`}><Sparkles size={18} /></span><span className="ns-flow-main"><b>{item.name}</b><small>{item.detail || item.systems}</small></span><span className="ns-flow-trigger"><small>Quando</small><b>{item.trigger}</b></span><span className="ns-flow-run"><small>Então</small><b>{item.action || 'Ação não configurada'}</b></span><span className={`ns-automation-status${item.active ? ' is-active' : ''}`}>{item.active ? localDemo ? 'Exemplo ativo' : 'Ativo no n8n' : linked ? 'Rascunho n8n' : 'Modelo local'}</span><div className="ns-automation-row-actions">{!linked && supported && <button type="button" className="ns-secondary ns-create-n8n-button" disabled={Boolean(busy) || n8nLoading || !n8nData} title={!n8nData ? 'Conecte o n8n e atualize o status antes de criar.' : undefined} onClick={() => createN8nWorkflow(item)}>{busy === `create-n8n:${item.id}` ? 'Criando...' : 'Criar no n8n'}</button>}<IconButton label={`Editar ${item.name}`} disabled={Boolean(busy)} onClick={() => openEdit(item)}><Pencil size={15} /></IconButton><IconButton label={`Excluir ${item.name}`} disabled={Boolean(busy)} onClick={() => remove(item)}><Trash2 size={15} /></IconButton></div></article>; })}</div>}
    {items.length === 0 && !loading && <div className="ns-automation-empty"><Sparkles size={19} /><div><b>Nenhum fluxo configurado</b><span>Escolha um dos modelos abaixo para come&#231;ar. Nada ser&#225; executado sem ativa&#231;&#227;o expl&#237;cita.</span></div></div>}
    <div className="ns-automation-template-grid">{availableTemplates.map((template) => <article className="ns-automation-template" key={template.id}><div className="ns-automation-template-icon"><Sparkles size={17} /></div><span className="ns-automation-template-system">{template.systems}</span><h3>{template.name}</h3><p>{template.detail}</p><div className="ns-automation-template-flow"><span><small>Quando</small><b>{template.trigger}</b></span><ArrowUpRight size={14} /><span><small>Ent&#227;o</small><b>{template.action}</b></span></div><button type="button" className="ns-secondary" disabled={busy === template.id} onClick={() => addTemplate(template)}><Plus size={14} />{busy === template.id ? 'Adicionando...' : 'Adicionar fluxo'}</button></article>)}</div>
    <div className="ns-info-note"><ShieldCheck size={17} /><span>Criar no n8n gera um webhook autenticado ligado ao evento do modelo. Ao publicar, os eventos correspondentes do Focusshub acionam a automação; as ações criam tarefas no workspace sem duplicar os acompanhamentos nativos.</span></div>
    {form && <div className="ns-integration-modal-backdrop" role="presentation" onMouseDown={(event) => { if (busy !== 'save' && event.target === event.currentTarget) setForm(false); }}><form className="ns-integration-modal ns-automation-modal" role="dialog" aria-modal="true" aria-labelledby="automation-draft-title" aria-busy={busy === 'save'} onSubmit={saveDraft}><header><span className="ns-integration-logo sign"><Sparkles size={18} /></span><div><h2 id="automation-draft-title">{editing ? 'Editar rascunho' : 'Criar rascunho'}</h2><p>Esta configuração fica salva no workspace.</p></div><button type="button" aria-label="Fechar" disabled={busy === 'save'} onClick={() => setForm(false)}><X size={17} /></button></header><div className="ns-integration-fields"><label>Nome<input autoFocus required maxLength="70" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex.: Acompanhar novo cliente" /></label><label>Descrição<input value={draft.detail} onChange={(event) => setDraft({ ...draft, detail: event.target.value })} placeholder="O que este fluxo deve fazer?" /></label><label>Quando isso acontecer<select value={draft.trigger} onChange={(event) => { const trigger = event.target.value; setDraft((current) => ({ ...current, trigger, action: defaultAutomationAction(trigger, automationTemplates) })); }}>{triggers.map((item) => <option key={item}>{item}</option>)}</select></label><label>Então fazer<select value={draft.action} onChange={(event) => setDraft({ ...draft, action: event.target.value })} disabled={actions.length === 0}>{actions.map((item) => <option key={item}>{item}</option>)}</select></label></div>{formError && <div className="dashboard-data-error" role="alert">{formError}<button type="button" onClick={() => setFormError('')}>Fechar</button></div>}<div className="ns-integration-modal-note"><ShieldCheck size={15} />Salvar não cria nem executa um workflow no n8n.</div><footer><button type="button" className="ns-secondary" disabled={busy === 'save'} onClick={() => setForm(false)}>Cancelar</button><button type="submit" className="ns-primary" disabled={busy === 'save'}><Check size={14} />{busy === 'save' ? 'Salvando...' : editing ? 'Salvar rascunho' : 'Criar rascunho'}</button></footer></form></div>}
  </>;
}

export function ServiceScreen({ page, navigationContext = null, onNavigationContextConsumed = () => {} }) {
  const currentPage = normalizePage(page);
  const [toast, setToast] = useState('');
  const [clock, setClock] = useState(0);
  const notify = (message) => { setToast(message); window.clearTimeout(clock); setClock(window.setTimeout(() => setToast(''), 2800)); };
  const newAction = currentPage === 'financeiro' ? 'Novo lançamento' : null;
  const headerAction = () => { if (currentPage === 'financeiro') window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: { page: 'Receitas', context: { intentId: crypto.randomUUID(), action: 'create' } } })); };
  let activeContent;
  if (currentPage === 'financeiro') activeContent = <FinanceOverview notify={notify} />;
  else if (currentPage === 'cobrancas') activeContent = <PaymentConsole kind="orders" notify={notify} navigationContext={navigationContext} onNavigationContextConsumed={onNavigationContextConsumed} />;
  else if (['receitas', 'despesas'].includes(currentPage)) activeContent = <FinanceList page={currentPage} notify={notify} navigationContext={navigationContext} onNavigationContextConsumed={onNavigationContextConsumed} />;
  else if (currentPage === 'contas') activeContent = <Accounts notify={notify} />;
  else if (currentPage === 'assinaturas') activeContent = <PaymentConsole kind="subscriptions" notify={notify} navigationContext={navigationContext} onNavigationContextConsumed={onNavigationContextConsumed} />;
  else if (currentPage === 'caixa_entrada') activeContent = <Inbox notify={notify} navigationContext={navigationContext} onNavigationContextConsumed={onNavigationContextConsumed} />;
  else if (currentPage === 'whatsapp') activeContent = <WahaSessions notify={notify} />;
  else if (currentPage === 'tickets') activeContent = <Tickets notify={notify} navigationContext={navigationContext} onNavigationContextConsumed={onNavigationContextConsumed} />;
  else if (['sites', 'dominios', 'hospedagens', 'monitoramento'].includes(currentPage)) activeContent = <Sites page={currentPage} notify={notify} />;
  else if (currentPage === 'integracoes') activeContent = <Integrations notify={notify} />;
  else activeContent = <Automations notify={notify} />;
  return <main className="ns-screen"><div className="ns-screen-inner"><PageHeading page={currentPage} action={newAction} onAction={headerAction} />{activeContent}</div><Toast message={toast} onClose={() => setToast('')} /></main>;
}

export default ServiceScreen;
