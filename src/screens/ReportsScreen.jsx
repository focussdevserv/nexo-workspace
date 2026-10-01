import React, { useCallback, useEffect, useState } from 'react';
import { BriefcaseBusiness, CheckCircle2, CircleDollarSign, Clock3, Download, RefreshCw, Target, TrendingUp, Users } from 'lucide-react';
import './reports.css';
import { fetchAllRecords } from '../lib/workspace-api.js';
import { buildChartBuckets, inPeriod } from '../lib/reports.js';
import { downloadCsvFile, rowsToCsv } from '../lib/csv.js';

const periods = [{ id: 'month', label: 'Este mês', months: 1 }, { id: 'quarter', label: 'Últimos 90 dias', months: 3 }, { id: 'year', label: 'Este ano', months: 12 }];
const tabs = ['Visão geral', 'Comercial', 'Projetos', 'Financeiro'];
const currency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(value || 0);

export default function ReportsScreen({ notify }) {
  const [periodId, setPeriodId] = useState('month');
  const [tab, setTab] = useState('Visão geral');
  const [data, setData] = useState({ leads: [], projects: [], tasks: [], services: [], expenses: [], orders: [], hours: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const period = periods.find((item) => item.id === periodId);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const values = await Promise.all(['leads','projects','tasks','services','expenses','hours'].map((name) => fetchAllRecords(`/api/workspace/${name}`)).concat([fetchAllRecords('/api/billing/orders')]));
      setData({ leads: values[0], projects: values[1], tasks: values[2], services: values[3], expenses: values[4], hours: values[5], orders: values[6] });
      setError('');
    } catch (err) { setError(err.message || 'Não foi possível carregar os relatórios.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const now = new Date();
  const leads = data.leads.filter((item) => inPeriod(item, periodId, now, 'created'));
  const projects = data.projects.filter((item) => inPeriod(item, periodId, now));
  const won = leads.filter((item) => ['Fechado','Ganho','won','closed'].includes(item.stage || item.status));
  const activeProjects = data.projects.filter((item) => !['Concluído','Concluída','completed'].includes(item.status));
  const completedProjects = data.projects.filter((item) => ['Concluído','Concluída','completed'].includes(item.status) && inPeriod(item, periodId, now, 'completed'));
  const paidOrders = data.orders.filter((item) => ['paid','processed','approved'].includes(String(item.status).toLowerCase()) && inPeriod(item, periodId, now, 'paid'));
  const revenue = paidOrders.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const periodExpenses = data.expenses.filter((item) => inPeriod(item, periodId, now, 'expense'));
  const expenses = periodExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const conversion = leads.length ? Math.round(won.length / leads.length * 100) : 0;
  const recordedHours = data.hours.filter((item) => inPeriod(item, periodId, now, 'work')).reduce((sum, item) => sum + Number(item.minutes || item.durationMinutes || 0), 0);
  const kpis = tab === 'Comercial'
    ? [{ icon: Users, label: 'Leads recebidos', value: String(leads.length), hint: 'no período', tone: 'blue' }, { icon: Target, label: 'Conversão', value: `${conversion}%`, hint: `${won.length} negócios ganhos`, tone: 'green' }, { icon: CircleDollarSign, label: 'Vendas pagas', value: currency(revenue), hint: `${paidOrders.length} pagamentos`, tone: 'green' }, { icon: TrendingUp, label: 'Ticket médio', value: currency(paidOrders.length ? revenue / paidOrders.length : 0), hint: 'por pagamento', tone: 'violet' }]
    : tab === 'Projetos'
      ? [{ icon: BriefcaseBusiness, label: 'Projetos ativos', value: String(activeProjects.length), hint: 'cadastrados', tone: 'blue' }, { icon: CheckCircle2, label: 'Entregues', value: String(completedProjects.length), hint: 'no período', tone: 'green' }, { icon: Clock3, label: 'Horas registradas', value: `${Math.floor(recordedHours / 60)}h`, hint: 'no período', tone: 'violet' }, { icon: Target, label: 'Tarefas', value: String(data.tasks.length), hint: 'cadastradas', tone: 'amber' }]
      : [{ icon: CircleDollarSign, label: 'Receita paga', value: currency(revenue), hint: `${paidOrders.length} pagamentos no período`, tone: 'green' }, { icon: Target, label: 'Leads convertidos', value: `${conversion}%`, hint: `${won.length} de ${leads.length}`, tone: 'blue' }, { icon: CheckCircle2, label: 'Projetos entregues', value: String(completedProjects.length), hint: 'no período', tone: 'violet' }, { icon: TrendingUp, label: 'Despesas cadastradas', value: currency(expenses), hint: 'no período', tone: 'amber' }];
  const rows = tab === 'Comercial' ? leads.map((item) => [item.name || item.title || 'Lead', item.source || '—', item.stage || item.status || '—']) : tab === 'Projetos' ? projects.map((item) => [item.name || item.title || 'Projeto', item.client || '—', item.status || '—']) : tab === 'Financeiro' ? [...paidOrders.map((item) => [item.description || 'Pagamento', item.clientName || 'Cliente', currency(item.amount)]), ...periodExpenses.map((item) => [item.description || item.name || 'Despesa', item.category || item.supplier || 'Despesa', `− ${currency(item.amount)}`])] : data.services.map((item) => [item.name || item.title || 'Serviço', item.category || '—', currency(item.price || item.amount)]);
  const exportCsv = () => { const csv = rowsToCsv([['Registro','Categoria','Status'], ...rows]); downloadCsvFile(`relatorio-${periodId}-${tab.toLowerCase().replaceAll(' ','-')}.csv`, csv); notify('CSV exportado com os dados cadastrados.'); };
  const chartRows = tab === 'Projetos' ? completedProjects : tab === 'Comercial' ? leads : paidOrders;
  const chartField = tab === 'Projetos' ? 'completed' : tab === 'Comercial' ? 'created' : 'paid';
  const chartValues = buildChartBuckets(periodId, now, chartRows, tab === 'Projetos' || tab === 'Comercial' ? () => 1 : (item) => Number(item.amount || 0), chartField);
  const chartTotal = chartValues.reduce((sum, bucket) => sum + bucket.value, 0);
  const chartMax = Math.max(1, ...chartValues.map((bucket) => bucket.value));
  const chartFormat = tab === 'Projetos' ? (value) => `${value} entrega${value === 1 ? '' : 's'}` : tab === 'Comercial' ? (value) => `${value} lead${value === 1 ? '' : 's'}` : currency;
  return <div className="reports-module">
    <div className="reports-topline"><nav className="reports-tabs" aria-label="Tipo de relatório">{tabs.map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</nav><div className="reports-controls"><nav className="report-period">{periods.map((item) => <button key={item.id} className={periodId === item.id ? 'active' : ''} onClick={() => setPeriodId(item.id)}>{item.label}</button>)}</nav><button className="admin-secondary" onClick={load} disabled={loading}><RefreshCw size={14} className={loading ? 'report-refreshing' : ''} />{loading ? 'Atualizando...' : 'Atualizar'}</button><button className="admin-secondary" onClick={exportCsv} disabled={loading || Boolean(error)}><Download size={14} /> Exportar CSV</button></div></div>
    {error && <div className="reports-no-data" role="alert">{error}</div>}
    <section className="admin-stats reports-kpis">{kpis.map((item) => <ReportStat key={item.label} {...item} />)}</section>
    <section className="admin-panel report-chart" aria-busy={loading}><div className="admin-panel-head"><div><h2>{tab === 'Financeiro' || tab === 'Visão geral' ? 'Receita paga' : tab === 'Projetos' ? 'Entregas de projetos' : 'Leads recebidos'}</h2><p>{period.label} · valores agrupados a partir dos registros do workspace</p></div><span className="report-total">{tab === 'Projetos' || tab === 'Comercial' ? chartTotal : currency(chartTotal)} <small>{tab === 'Projetos' ? 'entregas' : tab === 'Comercial' ? 'leads' : 'receita'}</small></span></div>{loading ? <div className="reports-chart-empty" role="status">Carregando dados do workspace…</div> : error ? <div className="reports-chart-empty">Não foi possível montar o gráfico. Atualize para tentar novamente.</div> : chartTotal > 0 ? <div className={`reports-chart-bars ${periodId === 'quarter' ? 'reports-chart-weeks' : ''}`} role="img" aria-label={`${tab === 'Projetos' ? 'Entregas' : tab === 'Comercial' ? 'Leads recebidos' : 'Receita paga'} por período`}>
      {chartValues.map((bucket) => { const height = bucket.value ? Math.max(5, bucket.value / chartMax * 100) : 0; return <div className="reports-chart-column" key={bucket.key} title={`${bucket.label}: ${chartFormat(bucket.value)}`}><div className="reports-chart-track"><i style={{ height: `${height}%` }} /></div><span>{bucket.label}</span></div>; })}
    </div> : <div className="reports-chart-empty">Ainda não há registros neste período para montar o gráfico.</div>}</section>
    <section className="admin-panel"><div className="admin-panel-head"><div><h2>{tab === 'Comercial' ? 'Oportunidades' : tab === 'Projetos' ? 'Projetos' : tab === 'Financeiro' ? 'Movimentações financeiras' : 'Serviços cadastrados'}</h2><p>Resultados obtidos dos registros do workspace.</p></div><button className="admin-link" onClick={() => window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: tab === 'Comercial' ? 'CRM' : tab === 'Projetos' ? 'Projetos' : tab === 'Financeiro' ? 'Cobranças' : 'Serviços' }))}>Abrir módulo <span>→</span></button></div><div className="report-service-table"><div className="report-service-row report-service-head"><span>Registro</span><span>Categoria / cliente</span><span>Status / valor</span></div>{rows.slice(0, 10).map((row,index) => <div className="report-service-row" key={`${row[0]}-${index}`}><span>{row[0]}</span><span>{row[1]}</span><span>{row[2]}</span></div>)}{!rows.length && <div className="reports-no-data">Nenhum registro cadastrado nesta área.</div>}</div></section>
  </div>;
}
function ReportStat({ icon: Icon, label, value, hint, tone }) { return <article className="admin-stat"><span className={`admin-stat-icon ${tone}`}><Icon size={18} /></span><span className="admin-stat-copy"><small>{label}</small><strong>{value}</strong><em>{hint}</em></span></article>; }
