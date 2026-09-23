import React, { useMemo, useState } from 'react';
import { ArrowDownToLine, BriefcaseBusiness, CheckCircle2, CircleDollarSign, Clock3, Download, Target, TrendingUp, Users } from 'lucide-react';
import './reports.css';

const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const monthRevenue = [12800, 16400, 14200, 20900, 18800, 23300, 19700, 26800, 28450, 0, 0, 0];
const serviceStats = [
  { service: 'Formulários do site', projects: 14, revenue: 0, change: 22, category: 'Comercial' },
  { service: 'Indicações', projects: 11, revenue: 0, change: 14, category: 'Comercial' },
  { service: 'Instagram', projects: 9, revenue: 0, change: -4, category: 'Comercial' },
  { service: 'Tráfego pago', projects: 8, revenue: 0, change: 9, category: 'Comercial' },
  { service: 'Site institucional', projects: 8, revenue: 42500, change: 18, category: 'Projetos' },
  { service: 'Manutenção mensal', projects: 31, revenue: 12400, change: 8, category: 'Financeiro' },
  { service: 'Landing page', projects: 6, revenue: 18700, change: 11, category: 'Projetos' },
  { service: 'Gestão de tráfego', projects: 9, revenue: 21600, change: 5, category: 'Financeiro' },
];
const periods = [{ id: 'month', label: 'Este mês', months: 1 }, { id: 'quarter', label: 'Últimos 90 dias', months: 3 }, { id: 'year', label: 'Este ano', months: 12 }];
const tabs = ['Visão geral', 'Comercial', 'Projetos', 'Financeiro'];
const currency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

export default function ReportsScreen({ notify }) {
  const [periodId, setPeriodId] = useState('month');
  const [tab, setTab] = useState('Visão geral');
  const [showAll, setShowAll] = useState(false);
  const period = periods.find((item) => item.id === periodId);
  const selectedMonths = monthRevenue.slice(Math.max(0, new Date().getMonth() - period.months + 1), new Date().getMonth() + 1);
  const filteredServices = useMemo(() => serviceStats.filter((row) => tab === 'Visão geral' ? row.category !== 'Comercial' : row.category === tab), [tab]);
  const monthlyRevenue = selectedMonths.reduce((sum, value) => sum + value, 0);
  const chartMonths = months.slice(Math.max(0, new Date().getMonth() - period.months + 1), new Date().getMonth() + 1);
  const chartValues = selectedMonths.length ? selectedMonths : [0];
  const chartMax = Math.max(...chartValues, 1);

  const exportCsv = () => {
    const rows = [['Serviço', 'Categoria', 'Projetos', 'Receita (BRL)', 'Variação (%)'], ...filteredServices.map((item) => [item.service, item.category, item.projects, item.revenue, item.change])];
    const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `nexo-relatorio-${periodId}-${tab.toLowerCase().replaceAll(' ', '-')}.csv`; link.click(); URL.revokeObjectURL(url);
    notify('Relatório exportado em CSV.');
  };
  const kpis = tab === 'Comercial'
    ? [{ icon: Users, label: 'Leads recebidos', value: periodId === 'month' ? '42' : periodId === 'quarter' ? '118' : '326', hint: 'no período', tone: 'blue' }, { icon: Target, label: 'Conversão', value: '24,6%', hint: '+3,2 pontos', tone: 'green' }, { icon: CircleDollarSign, label: 'Vendas fechadas', value: 'R$ 36.800', hint: '7 negócios', tone: 'green' }, { icon: TrendingUp, label: 'Ticket médio', value: 'R$ 5.257', hint: 'por negócio', tone: 'violet' }]
    : tab === 'Projetos'
      ? [{ icon: BriefcaseBusiness, label: 'Projetos ativos', value: '14', hint: 'em 8 clientes', tone: 'blue' }, { icon: CheckCircle2, label: 'Entregues', value: periodId === 'month' ? '7' : '19', hint: 'no período', tone: 'green' }, { icon: Clock3, label: 'Horas registradas', value: '186h', hint: 'em 12 projetos', tone: 'violet' }, { icon: Target, label: 'No prazo', value: '86%', hint: 'dos projetos', tone: 'amber' }]
      : tab === 'Financeiro'
        ? [{ icon: CircleDollarSign, label: 'Faturamento', value: currency(monthlyRevenue), hint: 'no período', tone: 'green' }, { icon: TrendingUp, label: 'Receita recorrente', value: 'R$ 12.400', hint: 'MRR atual', tone: 'blue' }, { icon: ArrowDownToLine, label: 'Despesas', value: 'R$ 8.920', hint: 'no período', tone: 'amber' }, { icon: Target, label: 'Inadimplência', value: '4,8%', hint: 'do faturamento', tone: 'violet' }]
        : [{ icon: CircleDollarSign, label: 'Faturamento', value: currency(monthlyRevenue), hint: 'no período', tone: 'green' }, { icon: Target, label: 'Conversão de leads', value: '24,6%', hint: '+3,2 pontos', tone: 'blue' }, { icon: CheckCircle2, label: 'Projetos entregues', value: periodId === 'month' ? '7' : '19', hint: 'no período', tone: 'violet' }, { icon: Clock3, label: 'Horas registradas', value: '186h', hint: 'em 12 projetos', tone: 'amber' }];

  return <div className="reports-module">
    <div className="reports-topline"><nav className="reports-tabs" aria-label="Tipo de relatório">{tabs.map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}</button>)}</nav><div className="reports-controls"><nav className="report-period">{periods.map((item) => <button key={item.id} className={periodId === item.id ? 'active' : ''} onClick={() => setPeriodId(item.id)}>{item.label}</button>)}</nav><button className="admin-secondary" onClick={exportCsv}><Download size={14} /> Exportar CSV</button></div></div>
    <div className="reports-demo-note"><i /> Dados de demonstração · selecione uma área e um período para explorar os relatórios.</div>
    <section className="admin-stats reports-kpis">{kpis.map((item) => <ReportStat key={item.label} {...item} />)}</section>
    <section className="admin-panel report-chart"><div className="admin-panel-head"><div><h2>{tab === 'Financeiro' ? 'Receita no período' : tab === 'Projetos' ? 'Entregas e atividade' : tab === 'Comercial' ? 'Evolução comercial' : 'Resumo de faturamento'}</h2><p>{period.label} · {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date())}</p></div><span className="report-total">{currency(monthlyRevenue)} <small>registrados</small></span></div><div className="chart-grid"><div className="chart-y"><span>{currency(chartMax)}</span><span>{currency(chartMax * .66)}</span><span>{currency(chartMax * .33)}</span><span>R$ 0</span></div><div className="chart-bars">{chartValues.map((value, index) => <div className="chart-bar-item" key={`${chartMonths[index] || index}`} title={`${chartMonths[index]}: ${currency(value)}`}><i style={{ height: `${value ? Math.max(4, value / chartMax * 100) : 2}%` }} /><span>{chartMonths[index] || 'Período'}</span></div>)}</div></div></section>
    <section className="admin-panel"><div className="admin-panel-head"><div><h2>{tab === 'Comercial' ? 'Desempenho por origem' : tab === 'Projetos' ? 'Desempenho por serviço' : 'Receita por serviço'}</h2><p>Resumo de resultados associados a cada serviço.</p></div><button className="admin-link" onClick={() => setShowAll((value) => !value)}>{showAll ? 'Mostrar menos' : 'Ver todos'} <span>{showAll ? '−' : '+'}</span></button></div><div className="report-service-table"><div className="report-service-row report-service-head"><span>Serviço</span><span>Projetos</span><span>Receita</span><span>Variação</span></div>{(showAll ? filteredServices : filteredServices.slice(0, 3)).map((item) => <div className="report-service-row" key={item.service}><span>{item.service}</span><span>{item.projects}</span><span>{currency(item.revenue)}</span><span className={item.change >= 0 ? 'report-positive' : ''}>{item.change > 0 ? '+' : ''}{item.change}%</span></div>)}{filteredServices.length === 0 && <div className="reports-no-data">Ainda não há itens de demonstração nesta área.</div>}</div></section>
    <p className="reports-footnote">Os valores exibidos são exemplos para validar o layout. Os dados serão vinculados aos módulos quando a API for construída.</p>
  </div>;
}

function ReportStat({ icon: Icon, label, value, hint, tone }) { return <article className="admin-stat"><span className={`admin-stat-icon ${tone}`}><Icon size={18} /></span><span className="admin-stat-copy"><small>{label}</small><strong>{value}</strong><em>{hint}</em></span></article>; }
