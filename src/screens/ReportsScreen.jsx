import React, { useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, CheckCircle2, CircleDollarSign, Clock3, Download, Target, TrendingUp, Users } from 'lucide-react';
import './reports.css';
import { apiRequest } from '../lib/workspace-api.js';

const periods = [{ id: 'month', label: 'Este mês', months: 1 }, { id: 'quarter', label: 'Últimos 90 dias', months: 3 }, { id: 'year', label: 'Este ano', months: 12 }];
const tabs = ['Visão geral', 'Comercial', 'Projetos', 'Financeiro'];
const currency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(value || 0);
const dateOf = (item) => new Date(item.createdAt || item.updatedAt || item.date || item.dueAt || 0);
const inPeriod = (item, period) => { const date = dateOf(item); const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth() - period.months + 1, 1); return !Number.isNaN(date.getTime()) && date >= start && date <= now; };

export default function ReportsScreen({ notify }) {
  const [periodId, setPeriodId] = useState('month');
  const [tab, setTab] = useState('Visão geral');
  const [data, setData] = useState({ leads: [], projects: [], tasks: [], services: [], expenses: [], orders: [], hours: [] });
  const [error, setError] = useState('');
  const period = periods.find((item) => item.id === periodId);
  useEffect(() => {
    let active = true;
    Promise.all(['leads','projects','tasks','services','expenses','hours'].map((name) => apiRequest(`/api/workspace/${name}`)).concat([apiRequest('/api/billing/orders')]))
      .then((values) => { if (active) { setData({ leads: values[0].data || [], projects: values[1].data || [], tasks: values[2].data || [], services: values[3].data || [], expenses: values[4].data || [], hours: values[5].data || [], orders: values[6].data || [] }); setError(''); } })
      .catch((err) => { if (active) setError(err.message || 'Não foi possível carregar os relatórios.'); });
    return () => { active = false; };
  }, []);
  const leads = data.leads.filter((item) => inPeriod(item, period));
  const projects = data.projects.filter((item) => inPeriod(item, period));
  const won = leads.filter((item) => ['Fechado','Ganho','won','closed'].includes(item.stage || item.status));
  const activeProjects = data.projects.filter((item) => !['Concluído','Concluída','completed'].includes(item.status));
  const completedProjects = projects.filter((item) => ['Concluído','Concluída','completed'].includes(item.status));
  const paidOrders = data.orders.filter((item) => ['paid','processed','approved'].includes(String(item.status).toLowerCase()) && inPeriod(item, period));
  const revenue = paidOrders.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expenses = data.expenses.filter((item) => inPeriod(item, period)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const conversion = leads.length ? Math.round(won.length / leads.length * 100) : 0;
  const recordedHours = data.hours.filter((item) => inPeriod(item, period)).reduce((sum, item) => sum + Number(item.minutes || item.durationMinutes || 0), 0);
  const kpis = tab === 'Comercial'
    ? [{ icon: Users, label: 'Leads recebidos', value: String(leads.length), hint: 'no período', tone: 'blue' }, { icon: Target, label: 'Conversão', value: `${conversion}%`, hint: `${won.length} negócios ganhos`, tone: 'green' }, { icon: CircleDollarSign, label: 'Vendas pagas', value: currency(revenue), hint: `${paidOrders.length} pagamentos`, tone: 'green' }, { icon: TrendingUp, label: 'Ticket médio', value: currency(paidOrders.length ? revenue / paidOrders.length : 0), hint: 'por pagamento', tone: 'violet' }]
    : tab === 'Projetos'
      ? [{ icon: BriefcaseBusiness, label: 'Projetos ativos', value: String(activeProjects.length), hint: 'cadastrados', tone: 'blue' }, { icon: CheckCircle2, label: 'Entregues', value: String(completedProjects.length), hint: 'no período', tone: 'green' }, { icon: Clock3, label: 'Horas registradas', value: `${Math.floor(recordedHours / 60)}h`, hint: 'no período', tone: 'violet' }, { icon: Target, label: 'Tarefas', value: String(data.tasks.length), hint: 'cadastradas', tone: 'amber' }]
      : [{ icon: CircleDollarSign, label: 'Receita paga', value: currency(revenue), hint: `${paidOrders.length} pagamentos no período`, tone: 'green' }, { icon: Target, label: 'Leads convertidos', value: `${conversion}%`, hint: `${won.length} de ${leads.length}`, tone: 'blue' }, { icon: CheckCircle2, label: 'Projetos entregues', value: String(completedProjects.length), hint: 'no período', tone: 'violet' }, { icon: TrendingUp, label: 'Despesas cadastradas', value: currency(expenses), hint: 'no período', tone: 'amber' }];
  const rows = tab === 'Comercial' ? leads.map((item) => [item.name || item.title || 'Lead', item.source || '—', item.stage || item.status || '—']) : tab === 'Projetos' ? projects.map((item) => [item.name || item.title || 'Projeto', item.client || '—', item.status || '—']) : data.services.map((item) => [item.name || item.title || 'Serviço', item.category || '—', currency(item.price || item.amount)]);
  const exportCsv = () => { const csv = `\uFEFF${[['Registro','Categoria','Status'], ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll('"','""')}"`).join(';')).join('\r\n')}`; const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = `relatorio-${periodId}-${tab.toLowerCase().replaceAll(' ','-')}.csv`; link.click(); URL.revokeObjectURL(url); notify('CSV exportado com os dados cadastrados.'); };
  const chartMonths = useMemo(() => Array.from({ length: period.months }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - period.months + index + 1); return date.toLocaleDateString('pt-BR', { month: 'short' }); }), [period]);
  return <div className="reports-module">
    <div className="reports-topline"><nav className="reports-tabs" aria-label="Tipo de relatório">{tabs.map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</nav><div className="reports-controls"><nav className="report-period">{periods.map((item) => <button key={item.id} className={periodId === item.id ? 'active' : ''} onClick={() => setPeriodId(item.id)}>{item.label}</button>)}</nav><button className="admin-secondary" onClick={exportCsv}><Download size={14} /> Exportar CSV</button></div></div>
    {error && <div className="reports-no-data" role="alert">{error}</div>}
    <section className="admin-stats reports-kpis">{kpis.map((item) => <ReportStat key={item.label} {...item} />)}</section>
    <section className="admin-panel report-chart"><div className="admin-panel-head"><div><h2>{tab === 'Financeiro' ? 'Receita paga' : tab === 'Projetos' ? 'Projetos entregues' : tab === 'Comercial' ? 'Leads no período' : 'Resumo do período'}</h2><p>{period.label} · dados cadastrados no workspace</p></div><span className="report-total">{tab === 'Projetos' ? projects.length : tab === 'Comercial' ? leads.length : currency(revenue)} <small>registros</small></span></div><div className="reports-no-data">{revenue || projects.length || leads.length ? `${chartMonths.length} períodos disponíveis; os registros são exibidos na tabela abaixo.` : 'Ainda não há dados cadastrados para montar este relatório.'}</div></section>
    <section className="admin-panel"><div className="admin-panel-head"><div><h2>{tab === 'Comercial' ? 'Oportunidades' : tab === 'Projetos' ? 'Projetos' : 'Serviços cadastrados'}</h2><p>Resultados obtidos dos registros do workspace.</p></div><button className="admin-link" onClick={() => window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: tab === 'Comercial' ? 'CRM' : tab === 'Projetos' ? 'Projetos' : 'Serviços' }))}>Abrir módulo <span>→</span></button></div><div className="report-service-table"><div className="report-service-row report-service-head"><span>Registro</span><span>Categoria / cliente</span><span>Status / valor</span></div>{rows.slice(0, 10).map((row,index) => <div className="report-service-row" key={`${row[0]}-${index}`}><span>{row[0]}</span><span>{row[1]}</span><span>{row[2]}</span></div>)}{!rows.length && <div className="reports-no-data">Nenhum registro cadastrado nesta área.</div>}</div></section>
  </div>;
}
function ReportStat({ icon: Icon, label, value, hint, tone }) { return <article className="admin-stat"><span className={`admin-stat-icon ${tone}`}><Icon size={18} /></span><span className="admin-stat-copy"><small>{label}</small><strong>{value}</strong><em>{hint}</em></span></article>; }
