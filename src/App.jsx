import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness,
  CalendarDays, Check, CheckSquare, ChevronDown, ChevronRight, CircleDollarSign,
  Clock3, FileText, FolderKanban, House, Inbox, Instagram, LayoutDashboard,
  Mail, MessageCircle, MoreVertical, Paperclip, Phone, Plus, Search, Send,
  Settings, Sparkles, Users, Video, X,
} from 'lucide-react';
import CommercialScreen from './screens/CommercialScreens.jsx';
import WorkScreen from './screens/WorkScreens.jsx';
import ServiceScreen from './screens/ServiceScreens.jsx';
import AdminScreen from './screens/AdminScreens.jsx';
import { PublicClientPortal } from './screens/ClientPortalScreens.jsx';

const commercialPages = new Set(['CRM', 'Leads', 'Pipeline', 'Clientes', 'Empresas', 'Contatos', 'Propostas', 'Serviços', 'Contratos']);
const workPages = new Set(['Agenda', 'Tarefas', 'Aprovações', 'Projetos', 'Horas', 'Arquivos']);
const servicePages = new Set(['Financeiro', 'Receitas', 'Despesas', 'Contas', 'Cobranças', 'Assinaturas', 'Caixa de entrada', 'WhatsApp', 'Tickets', 'Sites', 'Domínios', 'Hospedagens', 'Monitoramento', 'Integrações', 'Automações']);
const adminPages = new Set(['Equipe', 'Relatórios', 'Metas', 'Configurações', 'Portal do cliente', 'Repositórios']);

function ModuleScreen({ page }) {
  if (commercialPages.has(page)) return <CommercialScreen key={page} page={page} />;
  if (workPages.has(page)) return <WorkScreen key={page} page={page} />;
  if (servicePages.has(page)) return <ServiceScreen key={page} page={page} />;
  if (adminPages.has(page)) return <AdminScreen key={page} page={page} />;
  return <div className="module-screen-shell"><header className="module-page-header"><div><span className="eyebrow">NEXO · WORKSPACE</span><h1>{page}</h1><p>Organize esta área da sua agência em um só lugar.</p></div></header></div>;
}

const leads = [
  { name: 'Mariana Silva', company: 'Clínica VidaMais', initials: 'MS', color: 'rose', source: 'Site', icon: 'site', service: 'Site institucional', note: '“Precisamos de um site moderno e responsivo.”', action: 'Agendar apresentação', actionType: 'green' },
  { name: 'Rafael Costa', company: 'NovaEra Imóveis', initials: 'RC', color: 'blue', source: 'Indicação', icon: 'referral', service: 'Gestão de redes sociais', note: '“Queremos aumentar a presença digital da marca.”', action: 'Enviar proposta', actionType: 'blue' },
  { name: 'Juliana Martins', company: 'Doce Ponto', initials: 'JM', color: 'lilac', source: 'Instagram', icon: 'instagram', service: 'Identidade visual', note: '“Precisamos de uma nova identidade para a loja.”', action: 'Marcar reunião', actionType: 'blue' },
  { name: 'Thiago Mendes', company: 'Studio Movimento', initials: 'TM', color: 'amber', source: 'Tráfego pago', icon: 'ads', service: 'Campanhas Google Ads', note: '“Queremos gerar mais leads qualificados.”', action: 'Enviar materiais', actionType: 'blue' },
];

const initialTasks = [
  { id: 1, time: '14:00', title: 'Revisar homepage', company: 'NovaEra Imóveis', detail: 'Validar ajustes de layout e textos com o cliente.', state: 'Em andamento', featured: true, initials: 'RC' },
  { id: 2, time: '15:30', title: 'Reunião com cliente', company: 'Clínica VidaMais', detail: 'Alinhar estratégia de conteúdo para o próximo mês.', state: 'Pendente', initials: 'MS' },
  { id: 3, time: '17:00', title: 'Enviar proposta', company: 'Studio Movimento', detail: 'Finalizar proposta comercial e enviar por e-mail.', state: 'Pendente', initials: 'TM' },
];

const navGroups = [
  { label: 'Meu trabalho', items: [
    { label: 'Meu Dia', icon: House }, { label: 'Agenda', icon: CalendarDays },
    { label: 'Tarefas', icon: CheckSquare }, { label: 'Caixa de entrada', icon: Inbox },
    { label: 'Aprovações', icon: Check },
  ] },
  { label: 'Comercial', items: [
    { label: 'CRM', icon: Users }, { label: 'Leads', icon: Users },
    { label: 'Pipeline', icon: Activity }, { label: 'Clientes', icon: Users },
    { label: 'Empresas', icon: BriefcaseBusiness }, { label: 'Contatos', icon: Users },
    { label: 'Propostas', icon: FileText }, { label: 'Serviços', icon: LayoutDashboard },
    { label: 'Contratos', icon: FileText },
  ] },
  { label: 'Projetos', items: [
    { label: 'Projetos', icon: FolderKanban }, { label: 'Horas', icon: Clock3 },
    { label: 'Arquivos', icon: Paperclip },
  ] },
  { label: 'Atendimento', items: [
    { label: 'WhatsApp', icon: MessageCircle }, { label: 'Tickets', icon: Inbox },
  ] },
  { label: 'Sites', items: [
    { label: 'Sites', icon: LayoutDashboard }, { label: 'Domínios', icon: LayoutDashboard },
    { label: 'Hospedagens', icon: BriefcaseBusiness }, { label: 'Repositórios', icon: BriefcaseBusiness },
    { label: 'Monitoramento', icon: Activity },
  ] },
  { label: 'Financeiro', items: [
    { label: 'Financeiro', icon: CircleDollarSign }, { label: 'Receitas', icon: CircleDollarSign },
    { label: 'Despesas', icon: CircleDollarSign }, { label: 'Contas', icon: FileText },
    { label: 'Cobranças', icon: CircleDollarSign }, { label: 'Assinaturas', icon: CircleDollarSign },
  ] },
  { label: 'Documentos', items: [ { label: 'Portal do cliente', icon: Users } ] },
  { label: 'Equipe', items: [ { label: 'Equipe', icon: Users } ] },
  { label: 'Automações', items: [
    { label: 'Automações', icon: Sparkles }, { label: 'Integrações', icon: LayoutDashboard },
  ] },
  { label: 'Gestão', items: [
    { label: 'Relatórios', icon: Activity }, { label: 'Metas', icon: CheckSquare },
    { label: 'Configurações', icon: Settings },
  ] },
];

function Avatar({ initials, color = 'blue', small = false, online = false }) {
  return <span className={`avatar avatar-${color} ${small ? 'avatar-small' : ''} ${online ? 'avatar-online' : ''}`}>{initials}</span>;
}

function readLocalValue(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }
function amountValue(value) { return Number(String(value || '').replace(/[^\d,]/g, '').replace(',', '.')) || 0; }

function App() {
  const [activeNav, setActiveNav] = useState('Meu Dia');
  const [createOpen, setCreateOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [taskFilter, setTaskFilter] = useState('Todas');
  const [tasks, setTasks] = useState(() => { try { return JSON.parse(localStorage.getItem('nexo.dashboard.tasks.v1') || 'null') || initialTasks; } catch { return initialTasks; } });
  const [chatOpen, setChatOpen] = useState(true);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [toast, setToast] = useState('');
  const [now, setNow] = useState('13:25');
  const commercial = readLocalValue('nexo.commercial.records.v1', {});
  const sourceLeads = Array.isArray(commercial.leads) ? commercial.leads : leads;
  const dashboardLeads = sourceLeads.map((item) => ({ ...item, company: item.company || item.client || 'Empresa sem cadastro', color: item.color || item.tone || 'blue', initials: item.initials || item.name?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), note: item.note || item.notes || item.service || 'Oportunidade em acompanhamento', action: item.action || (item.stage === 'Proposta enviada' ? 'Enviar proposta' : 'Ver oportunidade'), actionType: item.actionType || 'blue' }));
  const dashboardProjects = readLocalValue('nexo.work.projects.v1', [{ status: 'Em andamento' }, { status: 'Em andamento' }, { status: 'Aguardando cliente' }, { status: 'Em andamento' }, { status: 'Concluído' }]);
  const dashboardBills = readLocalValue('nexo.billing.v1', [{ amount: 4800, due: '2026-09-30', status: 'Aguardando' }, { amount: 3750, due: '2026-09-25', status: 'Enviada' }, { amount: 2400, due: '2026-09-18', status: 'Vencida' }, { amount: 1250, due: '2026-09-16', status: 'Enviada' }]);
  const openBills = dashboardBills.filter((bill) => !['Paga', 'Cancelada'].includes(bill.status));
  const todayIso = new Date().toISOString().slice(0, 10);
  const nextMonthIso = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const overdueBills = openBills.filter((bill) => bill.due && bill.due < todayIso || ['Vencida', 'Atrasada'].includes(bill.status));
  const upcomingAmount = openBills.filter((bill) => !bill.due || bill.due <= nextMonthIso).reduce((sum, bill) => sum + Number(bill.amount || amountValue(bill.value)), 0);
  const activeProjects = dashboardProjects.filter((project) => project.status !== 'Concluído' && project.status !== 'Concluida');

  useEffect(() => {
    const navigate = (event) => { if (event.detail && navGroups.some((group) => group.items.some((item) => item.label === event.detail))) setActiveNav(event.detail); };
    window.addEventListener('nexo:navigate', navigate);
    return () => window.removeEventListener('nexo:navigate', navigate);
  }, []);

  const visibleLeads = useMemo(() => {
    if (filter === 'Todos') return dashboardLeads;
    return dashboardLeads.filter((lead) => lead.source === filter);
  }, [filter, commercial]);

  const visibleTasks = useMemo(() => {
    if (taskFilter === 'Em andamento') return tasks.filter((task) => task.state === 'Em andamento');
    if (taskFilter === 'Pendente') return tasks.filter((task) => task.state === 'Pendente');
    if (taskFilter === 'Concluída') return tasks.filter((task) => task.state === 'Concluída');
    return tasks;
  }, [taskFilter, tasks]);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const toggleTask = (id) => {
    setTasks((current) => { const next = current.map((task) => task.id === id ? { ...task, state: task.state === 'Concluída' ? 'Pendente' : 'Concluída' } : task); localStorage.setItem('nexo.dashboard.tasks.v1', JSON.stringify(next)); try { const workTasks = JSON.parse(localStorage.getItem('nexo.work.tasks.v1') || '[]'); const changed = next.find((item) => item.id === id); localStorage.setItem('nexo.work.tasks.v1', JSON.stringify(workTasks.map((item) => item.title === changed?.title ? { ...item, status: changed.state === 'Concluída' ? 'Concluída' : 'A fazer' } : item))); } catch {} return next; });
  };

  const handleLeadAction = (lead) => { const destination = /proposta/i.test(lead.action) ? 'Propostas' : /reunião|agendar|apresentação/i.test(lead.action) ? 'Agenda' : 'Pipeline'; setActiveNav(destination); notify(`${lead.name} · abrindo ${destination.toLowerCase()}`); };

  if (window.location.pathname.startsWith('/portal/')) return <PublicClientPortal slug={window.location.pathname.split('/').filter(Boolean).at(-1)} />;

  return (
    <div className="app-shell">
      <aside className="side-nav" aria-label="Navegação principal">
        <button className="side-brand" aria-label="Nexo início" onClick={() => setActiveNav('Meu Dia')}>
          <span className="brand-glyph"><i /><b /><em /></span><strong>nexo</strong>
        </button>
        <nav className="side-nav-scroll">
          {navGroups.map((group) => <div className="nav-group" key={group.label}>
            <span className="nav-group-title">{group.label}</span>
            {group.items.map(({ label, icon: Icon }) => <button key={label} className={`side-nav-link ${activeNav === label ? 'active' : ''}`} onClick={() => setActiveNav(label)} aria-current={activeNav === label ? 'page' : undefined} title={label}>
              <Icon size={16} strokeWidth={1.8} /><span>{label}</span>
            </button>)}
          </div>)}
        </nav>
        <button className="profile-shortcut" onClick={() => setActiveNav('Configurações')}><Avatar initials="GS" color="teal" online /><span><b>Gustavo Silva</b><small>Nexo Agência</small></span><ChevronDown size={14} /></button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="day-strip">
            <div className="strip-title"><span className="strip-caption">{activeNav}</span><span className="date-chip"><CalendarDays size={13} /> Qua, 23 set</span></div>
            <div className="strip-event"><span>09:00</span><strong>Reunião interna</strong><span className="avatar-stack"><Avatar initials="GS" color="teal" small /><Avatar initials="AM" color="lilac" small /><Avatar initials="LC" color="rose" small /></span></div>
            <div className="strip-event"><span>11:30</span><strong>Cliente NovaEra</strong><Avatar initials="RC" color="blue" small /></div>
            <div className="strip-event strip-current"><span className="time-pin">{now}</span><span>14:00</span><strong>Revisão de site</strong><span className="avatar-stack"><Avatar initials="RC" color="blue" small /><Avatar initials="GS" color="teal" small /></span></div>
            <div className="strip-event"><span>16:00</span><strong>Planejamento Q4</strong><span className="avatar-stack"><Avatar initials="GS" color="teal" small /><Avatar initials="AM" color="lilac" small /></span></div>
          </div>
          <div className="top-actions"><button className="icon-button" aria-label="Buscar" aria-expanded={searchOpen} onClick={() => { setSearchOpen((open) => !open); setSearchQuery(''); }}><Search size={19} /></button><button className="icon-button notification-button" aria-label="Notificações" onClick={() => setActiveNav('Caixa de entrada')}><Bell size={19} /><i /></button><Avatar initials="GS" color="teal" online />{searchOpen && <div className="quick-search-panel"><label><Search size={15} /><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar uma área do Nexo" /></label>{navGroups.flatMap((group) => group.items).filter((item) => !searchQuery || item.label.toLocaleLowerCase('pt-BR').includes(searchQuery.toLocaleLowerCase('pt-BR'))).slice(0, 8).map((item) => <button type="button" key={item.label} onClick={() => { setActiveNav(item.label); setSearchOpen(false); }}>{item.label}<ArrowRight size={14} /></button>)}</div>}</div>
        </header>

        <div className="page-content">
          {activeNav === 'Meu Dia' ? <main className="dashboard-view">
          <div className="welcome-row">
            <div><p className="eyebrow">QUARTA-FEIRA, 23 DE SETEMBRO</p><h1>Olá, Gustavo <span className="wave">👋</span></h1><p className="welcome-subtitle">Aqui está o que merece sua atenção hoje.</p></div>
            <div className="dashboard-create-wrap"><button className="primary-button" aria-expanded={createOpen} onClick={() => setCreateOpen((open) => !open)}><Plus size={17} /> Criar novo <ChevronDown size={15} /></button>{createOpen && <div className="dashboard-create-menu" role="menu">{[['Lead', 'Leads'], ['Projeto', 'Projetos'], ['Tarefa', 'Tarefas'], ['Reunião', 'Agenda'], ['Cobrança', 'Cobranças']].map(([label, page]) => <button type="button" role="menuitem" key={page} onClick={() => { setActiveNav(page); setCreateOpen(false); }}>{label}<ArrowRight size={14} /></button>)}</div>}</div>
          </div>

          <section className="stats-grid" aria-label="Resumo">
            <StatCard title="Leads" value={String(sourceLeads.length)} change="" detail="oportunidades no pipeline" icon={Users} tone="green" />
            <StatCard title="Projetos" value={String(activeProjects.length)} change="" detail="em andamento" icon={FolderKanban} tone="blue" />
            <StatCard title="A receber" value={upcomingAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} change="" detail="próximos 30 dias · local" icon={CircleDollarSign} tone="green" />
            <StatCard title="Atrasadas" value={String(overdueBills.length)} change="" detail="cobranças em atraso" icon={Clock3} tone="red" negative />
          </section>

          <section className={`dashboard-grid ${chatOpen ? '' : 'chat-closed'}`}>
            <div className="dashboard-main">
            <section className="leads-section">
            <div className="section-heading">
              <div className="section-title-group"><h2>Leads novos</h2><span className="count-pill">{dashboardLeads.length} cadastrados</span></div>
              <div className="lead-filters" role="tablist" aria-label="Filtrar leads">
                {['Todos', 'Site', 'Indicação', 'Instagram', 'Tráfego pago'].map((item) => <button key={item} role="tab" aria-selected={filter === item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item}</button>)}
                <button className="filter-more" onClick={() => setActiveNav('Leads')}>Ver todos <ChevronRight size={13} /></button>
              </div>
            </div>
            <div className="lead-grid">
              {visibleLeads.map((lead) => <LeadCard key={lead.name} lead={lead} onAction={() => handleLeadAction(lead)} />)}
              {visibleLeads.length === 0 && <div className="empty-filter">Nenhum lead nesta origem por enquanto.</div>}
            </div>
            </section>
            <div className="tasks-area">
              <div className="section-heading task-heading"><div className="section-title-group"><h2>Tarefas de hoje</h2><span className="count-pill">{tasks.filter((task) => task.state !== 'Concluída').length} tarefas</span></div><div className="task-tabs">{['Todas', 'Em andamento', 'Pendente', 'Concluída'].map((item) => <button key={item} className={taskFilter === item ? 'selected' : ''} aria-pressed={taskFilter === item} onClick={() => setTaskFilter(item)}>{item}</button>)}</div></div>
              <div className="task-grid">
                {visibleTasks.map((task) => <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task.id)} onOpen={() => { setActiveNav('Tarefas'); notify(`Abrindo tarefas · ${task.title}`); }} />)}
                {visibleTasks.length === 0 && <div className="empty-filter">Nenhuma tarefa nesta situação.</div>}
              </div>
            </div>
            </div>
            {chatOpen && <aside className={`attention-panel ${chatExpanded ? 'expanded' : ''}`} aria-label="Painel de atendimento">
              <div className="attention-header"><div><span className="online-dot" /><h2>Atendimento</h2><span className="online-label">Online agora</span></div><div className="panel-controls"><button aria-label="Expandir atendimento" onClick={() => setChatExpanded(!chatExpanded)}><ArrowUpRight size={16} /></button><button aria-label="Fechar atendimento" onClick={() => setChatOpen(false)}><X size={16} /></button></div></div>
              <div className="call-preview"><div className="call-bg"><span className="call-initials">GS</span><span className="call-caption">Gustavo Silva <i>• em chamada</i></span></div><div className="call-controls"><button aria-label="Câmera" onClick={() => notify('Câmera ativada')}><Video size={16} /></button><button aria-label="Microfone" onClick={() => notify('Microfone ativado')}><Activity size={16} /></button><button aria-label="Compartilhar tela" onClick={() => notify('Compartilhamento de tela em breve')}><LayoutDashboard size={15} /></button><button className="hangup" aria-label="Encerrar chamada" onClick={() => notify('Chamada encerrada')}><Phone size={16} /></button></div></div>
              <button className="chat-snippet" onClick={() => setActiveNav('Caixa de entrada')}><span className="whatsapp-icon"><MessageCircle size={18} /></span><span className="chat-copy"><span className="chat-line"><b>Conversa no WhatsApp</b><small>13:12</small></span><span className="chat-contact">Camila · Clínica VidaMais</span><span className="chat-message">Perfeito! Podemos seguir com o layout. Me envia o cronograma atualizado? <span>🙂</span></span></span><ChevronRight size={17} /></button>
              <button className="next-meeting" onClick={() => setActiveNav('Agenda')}><span className="meeting-icon"><CalendarDays size={17} /></span><span className="meeting-copy"><b>Próxima reunião</b><small>Clínica VidaMais · Alinhamento de conteúdo</small></span><span className="meeting-time">Hoje, 15:30</span><ChevronRight size={15} /></button>
              <div className="panel-actions"><button className="outline-dark" onClick={() => setActiveNav('WhatsApp')}><Phone size={15} /> Ligar</button><button className="whatsapp-action" onClick={() => setActiveNav('WhatsApp')}><Send size={15} /> Enviar mensagem</button></div>
            </aside>}
          </section>

          <section className={`bottom-alerts ${chatOpen ? '' : 'chat-closed'}`}>
            <button className="alert-card" onClick={() => setActiveNav('Cobranças')}><span className="alert-icon red-bg"><CircleDollarSign size={18} /></span><span><b>Cobranças vencidas</b><small>Total de R$ 3.400 em aberto</small></span><span className="alert-count red-count">2</span><ChevronRight size={17} /></button>
            <button className="alert-card" onClick={() => setActiveNav('Propostas')}><span className="alert-icon blue-bg"><FileText size={18} /></span><span><b>Propostas pendentes</b><small>Aguardando retorno de clientes</small></span><span className="alert-count blue-count">3</span><ChevronRight size={17} /></button>
            <div className="quote-card"><Sparkles size={18} /><span>Grandes projetos nascem<br />de grandes relacionamentos.</span><b>nexo</b></div>
          </section>
          </main> : <ModuleScreen page={activeNav} />}
        </div>
      </section>
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}

function StatCard({ title, value, change, detail, icon: Icon, tone, negative = false }) {
  return <article className="stat-card"><span className={`stat-icon ${tone}`}><Icon size={19} strokeWidth={1.9} /></span><div className="stat-content"><span className="stat-title">{title}</span><strong>{value}</strong><span className="stat-foot"><span className={negative ? 'change negative' : 'change'}>{negative ? <ArrowUpRight size={13} /> : <ArrowUpRight size={13} />}{change}</span><small>{detail}</small></span></div></article>;
}

function LeadCard({ lead, onAction }) {
  const SourceIcon = lead.icon === 'instagram' ? Instagram : lead.icon === 'site' ? FolderKanban : lead.icon === 'ads' ? Activity : Users;
  return <article className="lead-card"><div className="lead-card-top"><Avatar initials={lead.initials} color={lead.color} /><button className="more-button" aria-label={`Mais ações para ${lead.name}`}><MoreVertical size={17} /></button></div><h3>{lead.name}</h3><p className="lead-company">{lead.company}</p><span className={`source-tag ${lead.icon}`}><SourceIcon size={12} />{lead.source}</span><p className="lead-service">{lead.service}</p><p className="lead-note">{lead.note}</p><button className={`lead-action ${lead.actionType}`} onClick={onAction}>{lead.action}<span><ArrowRight size={15} /></span></button></article>;
}

function TaskCard({ task, onToggle, onOpen }) {
  const done = task.state === 'Concluída';
  return <article className={`task-card ${task.featured ? 'featured' : ''} ${done ? 'done' : ''}`}>
    <div className="task-time"><span>{task.time}</span><span className="today-pill">Hoje</span><div className="task-avatar-stack"><Avatar initials={task.initials} color={task.initials === 'MS' ? 'rose' : task.initials === 'TM' ? 'amber' : 'blue'} small />{task.featured && <Avatar initials="GS" color="teal" small />}</div></div>
    <button className="task-title-button" onClick={onOpen}><h3>{task.title}</h3></button><p className="task-company"><BriefcaseBusiness size={13} />{task.company}</p><p className="task-detail">{task.detail}</p>
    <div className="task-card-footer"><button className={`task-state ${done ? 'completed' : task.featured ? 'in-progress' : ''}`} onClick={onToggle}>{done ? <Check size={13} /> : <Clock3 size={13} />}{task.state}</button><button className="task-open" aria-label={`Abrir ${task.title}`} onClick={onOpen}><ChevronRight size={19} /></button></div>
  </article>;
}

export default App;
