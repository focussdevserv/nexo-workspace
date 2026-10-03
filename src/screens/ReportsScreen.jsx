import React, { useCallback, useEffect, useState } from 'react';
import { BriefcaseBusiness, CheckCircle2, CircleDollarSign, Clock3, Download, RefreshCw, Target, TrendingUp, Users } from 'lucide-react';
import './reports.css';
import { fetchAllRecords } from '../lib/workspace-api.js';
import { buildChartBuckets, buildProjectReportRows, dateOf, formatReportHours, hasReportChartFailures, hasReportSourceFailures, inPeriod, paidReportRevenues, parseReportAmount, reportDateLabel, reportHours, reportSourceState, reportSourcesForTab } from '../lib/reports.js';
import { downloadCsvFile, rowsToCsv } from '../lib/csv.js';
import { reportTabForKey } from '../lib/report-tab-navigation.js';
import { isReportProjectActive, isReportProjectCompleted } from '../lib/report-project-status.js';

const periods = [{ id: 'month', label: 'Este mês', months: 1 }, { id: 'quarter', label: 'Últimos 90 dias', months: 3 }, { id: 'year', label: 'Este ano', months: 12 }];
const tabs = ['Visão geral', 'Comercial', 'Projetos', 'Financeiro'];
const reportSources = [
  { key: 'leads', path: '/api/workspace/leads', module: 'CRM' },
  { key: 'projects', path: '/api/workspace/projects', module: 'Projetos' },
  { key: 'tasks', path: '/api/workspace/tasks', module: 'Tarefas' },
  { key: 'revenues', path: '/api/workspace/revenues', module: 'Financeiro' },
  { key: 'expenses', path: '/api/workspace/expenses', module: 'Financeiro' },
  { key: 'hours', path: '/api/workspace/hours', module: 'Horas' },
  { key: 'orders', path: '/api/billing/orders', module: 'Financeiro' },
];
const canOpenReportDestination = (page) => {
  let user = null;
  try { user = JSON.parse(sessionStorage.getItem('nexo.api.user') || 'null'); } catch { return false; }
  if (user?.role === 'owner' || page === 'Meu Dia') return true;
  const module = page === 'CRM' ? 'crm' : page === 'Projetos' ? 'delivery' : page === 'Cobranças' ? 'finance' : null;
  if (!module) return false;
  const modulePermissions = user?.permissions?.[module];
  const explicitRead = user?.permissions?.[module]?.read;
  if (typeof explicitRead === 'boolean') return explicitRead;
  if (modulePermissions) return false;
  return user?.role !== 'member' || page === 'Projetos';
};
const currency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(parseReportAmount(value));
const statusKey = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

export default function ReportsScreen({ notify }) {
  const [periodId, setPeriodId] = useState('month');
  const [tab, setTab] = useState('Visão geral');
  const [data, setData] = useState({ leads: [], projects: [], tasks: [], revenues: [], expenses: [], orders: [], hours: [] });
  const [restrictedSources, setRestrictedSources] = useState([]);
  const [failedSources, setFailedSources] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const period = periods.find((item) => item.id === periodId);
  const load = useCallback(async () => {
    setLoading(true);
    const results = await Promise.all(reportSources.map(async (source) => {
      try { return { source, records: await fetchAllRecords(source.path) }; }
      catch (reason) { return { source, reason }; }
    }));
    const failures = results.filter((result) => result.reason);
    const permissionFailures = failures.filter((result) => result.reason.code === 'forbidden' || result.reason.details?.status === 403);
    const otherFailures = failures.filter((result) => !permissionFailures.includes(result));
    if (otherFailures.length) {
      setError(otherFailures[0].reason.message || 'Não foi possível carregar os relatórios.');
    } else {
      setError('');
    }
    setRestrictedSources(permissionFailures.map((result) => result.source.key));
    setFailedSources(otherFailures.map((result) => result.source.key));
    setData(Object.fromEntries(reportSources.map(({ key }) => [key, results.find((result) => result.source.key === key)?.records || []])));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const now = new Date();
  const leads = data.leads.filter((item) => inPeriod(item, periodId, now, 'created'));
  const projects = data.projects.filter((item) => inPeriod(item, periodId, now));
  const won = leads.filter((item) => [item.stage, item.status].some((value) => ['fechado','ganho','won','closed'].includes(statusKey(value))));
  const activeProjects = data.projects.filter(isReportProjectActive);
  const completedProjects = data.projects.filter((item) => isReportProjectCompleted(item) && inPeriod(item, periodId, now, 'completed'));
  const paidOrders = data.orders.filter((item) => ['paid','processed','approved','paga','pago','recebida'].includes(statusKey(item.status)) && inPeriod(item, periodId, now, 'paid'));
  const periodRevenues = data.revenues.filter((item) => inPeriod(item, periodId, now, 'expense'));
  const paidRevenues = paidReportRevenues(data.revenues, periodId, now);
  const revenue = [...paidOrders, ...paidRevenues].reduce((sum, item) => sum + parseReportAmount(item.amount ?? item.value), 0);
  const periodExpenses = data.expenses.filter((item) => inPeriod(item, periodId, now, 'expense'));
  const expenses = periodExpenses.reduce((sum, item) => sum + parseReportAmount(item.amount ?? item.value), 0);
  const conversion = leads.length ? Math.round(won.length / leads.length * 100) : 0;
  const recordedHours = data.hours.filter((item) => inPeriod(item, periodId, now, 'work')).reduce((sum, item) => sum + reportHours(item), 0);
  const sourceState = (source) => reportSourceState(source, restrictedSources, failedSources);
  const restricted = (source) => sourceState(source) === 'restricted';
  const failed = (source) => sourceState(source) === 'failed';
  const unavailable = (source, moduleLabel) => ({ value: 'Sem acesso', hint: `Leitura de ${moduleLabel} necessária`, restricted: true });
  const loadFailed = (moduleLabel) => ({ value: 'Indisponível', hint: `Falha ao carregar ${moduleLabel}`, restricted: false });
  const reportScope = reportSourcesForTab(tab);
  const relevantRestrictions = reportSources.filter(({ key }) => reportScope.includes(key) && restricted(key));
  const relevantFailures = hasReportSourceFailures(tab, failedSources);
  const kpis = tab === 'Comercial'
    ? [{ icon: Users, label: 'Leads recebidos', ...(restricted('leads') ? unavailable('leads', 'CRM') : failed('leads') ? loadFailed('CRM') : { value: String(leads.length), hint: 'no período' }), tone: 'blue' }, { icon: Target, label: 'Conversão', ...(restricted('leads') ? unavailable('leads', 'CRM') : failed('leads') ? loadFailed('CRM') : { value: `${conversion}%`, hint: `${won.length} negócios ganhos` }), tone: 'green' }, { icon: CircleDollarSign, label: 'Recebimentos', ...(restricted('orders') || restricted('revenues') ? unavailable('orders', 'Financeiro') : failed('orders') || failed('revenues') ? loadFailed('Financeiro') : { value: currency(revenue), hint: `${paidOrders.length + paidRevenues.length} recebimentos` }), tone: 'green' }, { icon: TrendingUp, label: 'Ticket médio', ...(restricted('orders') || restricted('revenues') ? unavailable('orders', 'Financeiro') : failed('orders') || failed('revenues') ? loadFailed('Financeiro') : { value: currency((paidOrders.length + paidRevenues.length) ? revenue / (paidOrders.length + paidRevenues.length) : 0), hint: 'por recebimento' }), tone: 'violet' }]
    : tab === 'Projetos'
      ? [{ icon: BriefcaseBusiness, label: 'Projetos ativos', ...(restricted('projects') ? unavailable('projects', 'Projetos') : failed('projects') ? loadFailed('Projetos') : { value: String(activeProjects.length), hint: 'cadastrados' }), tone: 'blue' }, { icon: CheckCircle2, label: 'Entregues', ...(restricted('projects') ? unavailable('projects', 'Projetos') : failed('projects') ? loadFailed('Projetos') : { value: String(completedProjects.length), hint: 'no período' }), tone: 'green' }, { icon: Clock3, label: 'Horas registradas', ...(restricted('hours') ? unavailable('hours', 'Horas') : failed('hours') ? loadFailed('Horas') : { value: formatReportHours(recordedHours), hint: 'no período' }), tone: 'violet' }, { icon: Target, label: 'Tarefas cadastradas', ...(restricted('tasks') ? unavailable('tasks', 'Tarefas') : failed('tasks') ? loadFailed('Tarefas') : { value: String(data.tasks.length), hint: 'no workspace' }), tone: 'amber' }]
      : [{ icon: CircleDollarSign, label: 'Receita paga', ...(restricted('orders') || restricted('revenues') ? unavailable('orders', 'Financeiro') : failed('orders') || failed('revenues') ? loadFailed('Financeiro') : { value: currency(revenue), hint: `${paidOrders.length + paidRevenues.length} recebimentos no período` }), tone: 'green' }, { icon: Target, label: 'Leads convertidos', ...(restricted('leads') ? unavailable('leads', 'CRM') : failed('leads') ? loadFailed('CRM') : { value: `${conversion}%`, hint: `${won.length} de ${leads.length}` }), tone: 'blue' }, { icon: CheckCircle2, label: 'Projetos entregues', ...(restricted('projects') ? unavailable('projects', 'Projetos') : failed('projects') ? loadFailed('Projetos') : { value: String(completedProjects.length), hint: 'no período' }), tone: 'violet' }, { icon: TrendingUp, label: 'Despesas cadastradas', ...(restricted('expenses') ? unavailable('expenses', 'Financeiro') : failed('expenses') ? loadFailed('Financeiro') : { value: currency(expenses), hint: 'no período' }), tone: 'amber' }];
  const overviewRows = [
    ...leads.map((item) => [item.name || item.title || 'Lead', `Lead · ${item.source || 'Origem não informada'}`, item.stage || item.status || 'Em acompanhamento', item.createdAt || item.created_at || '']),
    ...projects.map((item) => [item.name || item.title || 'Projeto', `Projeto · ${item.client || 'Cliente não informado'}`, item.status || 'Em andamento', item.createdAt || item.created_at || '']),
    ...paidOrders.map((item) => [item.description || 'Pagamento', `Cobrança · ${item.clientName || 'Cliente'}`, currency(item.amount ?? item.value), dateOf(item, 'paid')]),
    ...periodRevenues.map((item) => [item.description || item.name || 'Receita', `Receita · ${item.counterparty || item.client || 'Cliente'}`, `${item.status || 'Registrada'} · ${currency(item.amount ?? item.value)}`, item.date || item.createdAt || '']),
    ...periodExpenses.map((item) => [item.description || item.name || 'Despesa', `Despesa · ${item.category || item.supplier || 'Sem categoria'}`, `− ${currency(item.amount ?? item.value)}`, item.date || item.createdAt || '']),
  ].sort((a, b) => new Date(b[3] || 0).getTime() - new Date(a[3] || 0).getTime()).map(([name, category, status, date]) => [name, category, status, reportDateLabel(date)]);
  const rows = tab === 'Comercial' ? leads.map((item) => [item.name || item.title || 'Lead', item.source || '—', item.stage || item.status || '—', reportDateLabel(item.createdAt || item.created_at || item.date)]) : tab === 'Projetos' ? buildProjectReportRows(projects, data.tasks, data.hours, periodId, now) : tab === 'Financeiro' ? [...periodRevenues.map((item) => [item.description || item.name || 'Receita', item.counterparty || item.client || 'Cliente', `${item.status || 'Registrada'} · ${currency(item.amount ?? item.value)}`, reportDateLabel(item.date || item.createdAt || item.created_at)]), ...paidOrders.map((item) => [item.description || 'Pagamento', item.clientName || item.client || 'Cliente', `Pago · ${currency(item.amount ?? item.value)}`, reportDateLabel(dateOf(item, 'paid'))]), ...periodExpenses.map((item) => [item.description || item.name || 'Despesa', item.category || item.supplier || 'Despesa', `− ${currency(item.amount ?? item.value)}`, reportDateLabel(item.date || item.createdAt || item.created_at)])] : overviewRows;
  const exportCsv = () => { const csv = rowsToCsv([['Registro','Categoria / cliente','Status / valor','Data'], ...rows]); downloadCsvFile(`relatorio-${periodId}-${tab.toLowerCase().replaceAll(' ','-')}.csv`, csv); notify('CSV exportado com os registros permitidos pelo seu perfil.'); };
  const chartRows = tab === 'Projetos' ? completedProjects : tab === 'Comercial' ? leads : [...paidOrders, ...paidRevenues.map((item) => ({ ...item, paidAt: item.date || item.createdAt }))];
  const chartField = tab === 'Projetos' ? 'completed' : tab === 'Comercial' ? 'created' : 'paid';
  const chartSource = tab === 'Projetos' ? 'projects' : tab === 'Comercial' ? 'leads' : 'orders';
  const chartUnavailable = restricted(chartSource) || failed(chartSource) || ((tab === 'Financeiro' || tab === 'Visão geral') && (restricted('revenues') || failed('revenues')));
  const chartLoadFailed = hasReportChartFailures(tab, failedSources);
  const chartValues = buildChartBuckets(periodId, now, chartRows, tab === 'Projetos' || tab === 'Comercial' ? () => 1 : (item) => parseReportAmount(item.amount ?? item.value), chartField);
  const chartTotal = chartValues.reduce((sum, bucket) => sum + bucket.value, 0);
  const chartMax = Math.max(1, ...chartValues.map((bucket) => bucket.value));
  const chartFormat = tab === 'Projetos' ? (value) => `${value} entrega${value === 1 ? '' : 's'}` : tab === 'Comercial' ? (value) => `${value} lead${value === 1 ? '' : 's'}` : currency;
  const destination = tab === 'Comercial' ? 'CRM' : tab === 'Projetos' ? 'Projetos' : tab === 'Financeiro' ? 'Cobranças' : 'Meu Dia';
  const destinationAllowed = canOpenReportDestination(destination);
  const restrictedModuleNames = [...new Set(relevantRestrictions.map(({ module }) => module))];
  const handleReportTabKeyDown = (event) => {
    const nextTab = reportTabForKey(tab, event.key, tabs);
    if (nextTab === tab) return;
    event.preventDefault();
    const tabButtons = event.currentTarget.parentElement.querySelectorAll('[role="tab"]');
    tabButtons[tabs.indexOf(nextTab)]?.focus();
    setTab(nextTab);
  };
  return <div className="reports-module">
    <div className="reports-topline"><nav className="reports-tabs" aria-label="Tipo de relatório" role="tablist">{tabs.map((item) => <button key={item} id={`reports-tab-${periodId}-${tabs.indexOf(item)}`} type="button" role="tab" aria-controls="reports-tabpanel" aria-selected={tab === item} tabIndex={tab === item ? 0 : -1} className={tab === item ? 'active' : ''} onKeyDown={handleReportTabKeyDown} onClick={() => setTab(item)}>{item}</button>)}</nav><div className="reports-controls"><nav className="report-period" aria-label="Período">{periods.map((item) => <button key={item.id} aria-pressed={periodId === item.id} className={periodId === item.id ? 'active' : ''} onClick={() => setPeriodId(item.id)}>{item.label}</button>)}</nav><button className="admin-secondary" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? 'report-refreshing' : ''} />{loading ? 'Atualizando...' : 'Atualizar'}</button><button className="admin-secondary" onClick={exportCsv} disabled={loading || relevantFailures} title={relevantFailures ? 'Não é possível exportar: há fontes deste relatório indisponíveis.' : undefined}><Download size={14} /> Exportar CSV</button></div></div>
    <div id="reports-tabpanel" role="tabpanel" aria-labelledby={`reports-tab-${periodId}-${tabs.indexOf(tab)}`} tabIndex={0}>
    {error && <div className="reports-no-data" role="alert">Relatório incompleto: falha ao carregar {reportSources.filter(({ key }) => failed(key)).map(({ module }) => module).filter((module, index, all) => all.indexOf(module) === index).join(', ')}. Os indicadores dessas fontes aparecem como indisponíveis. {error}</div>}
    {!!restrictedModuleNames.length && <div className="reports-access-note" role="status">Parte dos dados foi ocultada pelo seu perfil: {restrictedModuleNames.join(', ')}. Os indicadores afetados aparecem como “Sem acesso”; nenhuma permissão foi ampliada.</div>}
    <section className="admin-stats reports-kpis">{kpis.map((item) => <ReportStat key={item.label} {...item} />)}</section>
    <section className="admin-panel report-chart" aria-busy={loading}><div className="admin-panel-head"><div><h2>{tab === 'Financeiro' || tab === 'Visão geral' ? 'Receita paga' : tab === 'Projetos' ? 'Entregas de projetos' : 'Leads recebidos'}</h2><p>{period.label} · valores agrupados a partir dos registros permitidos</p></div><span className="report-total">{chartUnavailable ? '—' : tab === 'Projetos' || tab === 'Comercial' ? chartTotal : currency(chartTotal)} <small>{chartUnavailable ? (chartLoadFailed ? 'falha ao carregar' : 'sem acesso') : tab === 'Projetos' ? 'entregas' : tab === 'Comercial' ? 'leads' : 'receita'}</small></span></div>{loading ? <div className="reports-chart-empty" role="status">Carregando dados do workspace…</div> : chartLoadFailed ? <div className="reports-chart-empty">Não foi possível montar o gráfico. Atualize para tentar novamente.</div> : chartUnavailable ? <div className="reports-chart-empty" role="status">{chartLoadFailed ? 'Não foi possível carregar todos os dados deste gráfico. Atualize para tentar novamente.' : `Seu perfil não tem leitura de ${reportSources.find(({ key }) => key === chartSource)?.module || 'este módulo'}. Peça à pessoa proprietária para revisar seu acesso.`}</div> : chartTotal > 0 ? <div className={`reports-chart-bars ${periodId === 'quarter' ? 'reports-chart-weeks' : ''}`} role="img" aria-label={`${tab === 'Projetos' ? 'Entregas' : tab === 'Comercial' ? 'Leads recebidos' : 'Receita paga'} por período`}>
      {chartValues.map((bucket) => { const height = bucket.value ? Math.max(5, bucket.value / chartMax * 100) : 0; return <div className="reports-chart-column" key={bucket.key} title={`${bucket.label}: ${chartFormat(bucket.value)}`}><div className="reports-chart-track"><i style={{ height: `${height}%` }} /></div><span>{bucket.label}</span></div>; })}
    </div> : <div className="reports-chart-empty">Ainda não há registros neste período.</div>}</section>
    <section className="admin-panel" aria-busy={loading}><div className="admin-panel-head"><div><h2>{tab === 'Comercial' ? 'Oportunidades' : tab === 'Projetos' ? 'Projetos' : tab === 'Financeiro' ? 'Movimentações financeiras' : 'Atividade do workspace'}</h2><p>{tab === 'Visão geral' ? 'Leads, projetos e movimentações recentes deste período.' : 'Resultados obtidos dos registros do workspace.'}</p></div>{destinationAllowed ? <button className="admin-link" onClick={() => window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: destination }))}>Abrir módulo <span>→</span></button> : <span className="reports-route-denied" role="status" title={`Seu perfil não pode abrir ${destination}.`}>Sem acesso ao módulo</span>}</div><div className="report-service-table"><div className="report-service-row report-service-head"><span>Registro</span><span>Categoria / cliente</span><span>Status / valor</span><span>Data</span></div>{loading ? <div className="reports-no-data" role="status">Carregando registros do workspace…</div> : <>{rows.slice(0, 10).map((row,index) => <div className="report-service-row" key={`${row[0]}-${index}`}><span>{row[0]}</span><span>{row[1]}</span><span>{row[2]}</span><span>{row[3] || '—'}</span></div>)}{!rows.length && <div className="reports-no-data">{relevantRestrictions.length ? 'Sem registros visíveis com as permissões atuais.' : 'Nenhum registro neste período.'}</div>}</>}</div></section>
    </div>
  </div>;
}
function ReportStat({ icon: Icon, label, value, hint, tone, restricted: isRestricted }) { return <article className={`admin-stat ${isRestricted ? 'report-stat-restricted' : ''}`}><span className={`admin-stat-icon ${tone}`}><Icon size={18} /></span><span className="admin-stat-copy"><small>{label}</small><strong>{value}</strong><em>{hint}</em></span></article>; }
