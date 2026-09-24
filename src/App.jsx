import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness,
  CalendarDays, Check, CheckSquare, ChevronDown, ChevronRight, CircleDollarSign,
  Clock3, FileText, FolderKanban, House, Inbox, Instagram, LayoutDashboard,
  Mail, MessageCircle, Menu, MoreVertical, Paperclip, Phone, Plus, Search, Send,
  Settings, Sparkles, Users, Video, X,
} from 'lucide-react';
import CommercialScreen from './screens/CommercialScreens.jsx';
import WorkScreen from './screens/WorkScreens.jsx';
import ServiceScreen from './screens/ServiceScreens.jsx';
import AdminScreen from './screens/AdminScreens.jsx';
import { PublicClientPortal } from './screens/ClientPortalScreens.jsx';
import WorkspaceAccess from './screens/WorkspaceAccess.jsx';
import PublicLegalPage from './screens/PublicLegalPages.jsx';
import { apiRequest } from './lib/workspace-api.js';
import { purgeFictitiousLocalData } from './lib/demo-data.js';
import './screens/forms-polish.css';
import './screens/buttons-polish.css';

purgeFictitiousLocalData();

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

const leads = [];
const initialTasks = [];

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
function workspacePageSlug(label) { return label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function workspacePageFromPath(pathname) {
  if (!pathname.startsWith('/app/')) return null;
  const slug = decodeURIComponent(pathname.slice('/app/'.length)).replace(/\/+$/, '');
  return navGroups.flatMap((group) => group.items).find((item) => workspacePageSlug(item.label) === slug)?.label || null;
}

function WorkspaceShell() {
  const [activeNav, setActiveNav] = useState(() => {
    const routedPage = workspacePageFromPath(window.location.pathname);
    if (routedPage) return routedPage;
    try {
      const savedPage = sessionStorage.getItem('nexo.workspace.activePage');
      return navGroups.some((group) => group.items.some((item) => item.label === savedPage)) ? savedPage : 'Meu Dia';
    } catch { return 'Meu Dia'; }
  });
  const initialRouteSync = useRef(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [taskFilter, setTaskFilter] = useState('Todas');
  const [tasks, setTasks] = useState([]);
  const [dashboardRecords, setDashboardRecords] = useState({ leads: [], projects: [], events: [], proposals: [], bills: [] });
  const [dashboardError, setDashboardError] = useState('');
  const [chatOpen, setChatOpen] = useState(true);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState([]);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(true);
  const [notificationError, setNotificationError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [now, setNow] = useState(() => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  const dashboardDate = useMemo(() => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()), []);
  const sourceLeads = dashboardRecords.leads;
  const dashboardLeads = sourceLeads.map((item) => ({ ...item, company: item.company || item.client || 'Empresa não informada', color: item.color || item.tone || 'blue', initials: item.initials || item.name?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), note: item.note || item.notes || item.service || 'Sem observações cadastradas', action: item.action || 'Abrir oportunidade', actionType: item.actionType || 'blue' }));
  const dashboardProjects = dashboardRecords.projects;
  const dashboardBills = dashboardRecords.bills;
  const closedBillStatuses = new Set(['paga', 'cancelada', 'paid', 'approved', 'processed', 'cancelled', 'canceled', 'refunded']);
  const openBills = dashboardBills.filter((bill) => !closedBillStatuses.has(String(bill.status || '').toLowerCase()));
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const nextMonthDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
  const nextMonthIso = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(nextMonthDate.getDate()).padStart(2, '0')}`;
  const todayEvents = dashboardRecords.events.filter((event) => String(event.date || event.startsAt || '').slice(0, 10) === todayIso).sort((a, b) => String(a.time || a.startsAt || '').localeCompare(String(b.time || b.startsAt || '')));
  const dueDate = (bill) => String(bill.dueAt || bill.due || '').slice(0, 10);
  const overdueBills = openBills.filter((bill) => (dueDate(bill) && dueDate(bill) < todayIso) || ['vencida', 'atrasada', 'overdue'].includes(String(bill.status || '').toLowerCase()));
  const upcomingBills = openBills.filter((bill) => dueDate(bill) && dueDate(bill) >= todayIso && dueDate(bill) <= nextMonthIso);
  const upcomingAmount = upcomingBills.reduce((sum, bill) => sum + Number(bill.amount || amountValue(bill.value)), 0);
  const activeProjects = dashboardProjects.filter((project) => !['Concluído', 'Concluída', 'Concluida', 'completed'].includes(project.status));

  const refreshDashboard = useCallback(async () => {
    try {
      const [leadResult, projectResult, taskResult, eventResult, proposalResult, billResult] = await Promise.all([
        apiRequest('/api/workspace/leads'), apiRequest('/api/workspace/projects'), apiRequest('/api/workspace/tasks'),
        apiRequest('/api/workspace/events'), apiRequest('/api/workspace/proposals'), apiRequest('/api/billing/orders'),
      ]);
      setDashboardRecords({ leads: leadResult.data || [], projects: projectResult.data || [], events: eventResult.data || [], proposals: proposalResult.data || [], bills: billResult.data || [] });
      setTasks((taskResult.data || []).map((task) => ({ ...task, state: task.state || task.status || 'Pendente', company: task.company || task.client || '', time: task.time || '', detail: task.description || task.detail || '' })));
      setDashboardError('');
    } catch (error) { setDashboardError(error.message || 'Não foi possível atualizar o resumo.'); }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const result = await apiRequest('/api/notifications');
      setNotificationItems(result.data || []);
      setNotificationUnread(result.unreadCount || 0);
      setNotificationError('');
    } catch (error) { setNotificationError(error.message || 'Não foi possível carregar as notificações.'); }
    finally { setNotificationLoading(false); }
  }, []);

  const markNotificationsRead = async () => {
    try {
      await apiRequest('/api/notifications/read', { method: 'POST', body: '{}' });
      setNotificationItems((items) => items.map((item) => ({ ...item, unread: false })));
      setNotificationUnread(0);
    } catch (error) { setNotificationError(error.message || 'Não foi possível marcar as notificações como lidas.'); }
  };

  useEffect(() => {
    refreshDashboard();
    const clock = window.setInterval(() => setNow(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })), 60_000);
    return () => window.clearInterval(clock);
  }, [refreshDashboard]);

  useEffect(() => {
    refreshNotifications();
    const timer = window.setInterval(refreshNotifications, 60_000);
    return () => window.clearInterval(timer);
  }, [refreshNotifications]);

  useEffect(() => {
    try { sessionStorage.setItem('nexo.workspace.activePage', activeNav); } catch { /* storage can be unavailable in restricted browser contexts */ }
  }, [activeNav]);

  useEffect(() => {
    const path = `/app/${workspacePageSlug(activeNav)}`;
    if (!initialRouteSync.current) {
      initialRouteSync.current = true;
      if (window.location.pathname !== path) window.history.replaceState({ nexo: true }, '', path);
      return;
    }
    if (window.location.pathname !== path) window.history.pushState({ nexo: true }, '', path);
  }, [activeNav]);

  useEffect(() => {
    const restoreRoute = () => {
      const page = workspacePageFromPath(window.location.pathname);
      if (page) setActiveNav(page);
      else { window.history.replaceState({ nexo: true }, '', '/app/meu-dia'); setActiveNav('Meu Dia'); }
    };
    window.addEventListener('popstate', restoreRoute);
    return () => window.removeEventListener('popstate', restoreRoute);
  }, []);

  useEffect(() => {
    const navigate = (event) => { if (event.detail && navGroups.some((group) => group.items.some((item) => item.label === event.detail))) { setActiveNav(event.detail); setMobileMenuOpen(false); } };
    window.addEventListener('nexo:navigate', navigate);
    return () => window.removeEventListener('nexo:navigate', navigate);
  }, []);

  useEffect(() => {
    const closeMenu = (event) => { if (event.key === 'Escape') setMobileMenuOpen(false); };
    window.addEventListener('keydown', closeMenu);
    return () => window.removeEventListener('keydown', closeMenu);
  }, []);

  useEffect(() => {
    const showWorkspaceError = (event) => { setToast(event.detail || 'Não foi possível salvar no servidor.'); };
    window.addEventListener('nexo:workspace-error', showWorkspaceError);
    return () => window.removeEventListener('nexo:workspace-error', showWorkspaceError);
  }, []);

  const visibleLeads = useMemo(() => {
    if (filter === 'Todos') return dashboardLeads;
    return dashboardLeads.filter((lead) => lead.source === filter);
  }, [filter, sourceLeads]);

  const currentUser = (() => { try { return JSON.parse(sessionStorage.getItem('nexo.api.user') || 'null'); } catch { return null; } })();
  const initials = (currentUser?.name || '').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const dateChip = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).format(today);

  const visibleTasks = useMemo(() => {
    const dueToday = tasks.filter((task) => String(task.dueAt || task.dueDate || task.due || '').slice(0, 10) === todayIso);
    const normalizedState = (task) => String(task.state || task.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (taskFilter === 'Em andamento') return dueToday.filter((task) => normalizedState(task) === 'em andamento');
    if (taskFilter === 'Pendente') return dueToday.filter((task) => ['pendente', 'a fazer', 'aberta', 'novo'].includes(normalizedState(task)));
    if (taskFilter === 'Concluída') return dueToday.filter((task) => ['concluida', 'concluido', 'completed', 'done'].includes(normalizedState(task)));
    return dueToday;
  }, [taskFilter, tasks, todayIso]);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const toggleTask = async (id) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    const state = ['Concluída', 'Concluido', 'completed'].includes(task.state) ? 'Pendente' : 'Concluída';
    try { const result = await apiRequest(`/api/workspace/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ data: { state, status: state } }) }); setTasks((current) => current.map((item) => item.id === id ? { ...item, ...result.data, state } : item)); }
    catch (error) { setDashboardError(error.message || 'Não foi possível atualizar a tarefa.'); }
  };

  const handleLeadAction = (lead) => { const destination = /proposta/i.test(lead.action) ? 'Propostas' : /reunião|agendar|apresentação/i.test(lead.action) ? 'Agenda' : 'Pipeline'; setActiveNav(destination); notify(`${lead.name} · abrindo ${destination.toLowerCase()}`); };

  return (
    <div className="app-shell">
      <aside id="workspace-mobile-navigation" className={`side-nav ${mobileMenuOpen ? 'mobile-open' : ''}`} aria-label="Navegação principal">
        <button className="side-brand" aria-label="Nexo início" onClick={() => { setActiveNav('Meu Dia'); setMobileMenuOpen(false); }}>
          <span className="brand-glyph"><i /><b /><em /></span><strong>nexo</strong>
        </button>
        <nav className="side-nav-scroll">
          {navGroups.map((group) => <div className="nav-group" key={group.label}>
            <span className="nav-group-title">{group.label}</span>
            {group.items.map(({ label, icon: Icon }) => <button key={label} className={`side-nav-link ${activeNav === label ? 'active' : ''}`} onClick={() => { setActiveNav(label); setMobileMenuOpen(false); }} aria-current={activeNav === label ? 'page' : undefined} aria-label={label} title={label}>
              <Icon size={16} strokeWidth={1.8} /><span>{label}</span>
            </button>)}
          </div>)}
        </nav>
        <button className="profile-shortcut" onClick={() => setActiveNav('Configurações')}><Avatar initials={initials || '—'} color="teal" online /><span><b>{currentUser?.name || currentUser?.email || 'Minha conta'}</b><small>{currentUser?.organizationName || 'Workspace'}</small></span><ChevronDown size={14} /></button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="day-strip">
            <div className="strip-title"><span className="strip-caption">{activeNav}</span><span className="date-chip"><CalendarDays size={13} /> {dateChip}</span></div>
            <div className={`strip-event ${todayEvents.length ? 'strip-current' : 'strip-idle'}`}><span className="time-pin">{now}</span><strong>{todayEvents[0]?.title || todayEvents[0]?.name || "Agenda livre"}</strong><span className="strip-empty">{todayEvents[0]?.time || (todayEvents[0]?.startsAt ? new Date(todayEvents[0].startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Sem compromissos marcados.")}</span></div>
          </div>
          {mobileMenuOpen && <button className="mobile-nav-backdrop" type="button" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} />}
          <div className="top-actions"><button className="icon-button mobile-menu-toggle" aria-label="Abrir menu" aria-expanded={mobileMenuOpen} aria-controls="workspace-mobile-navigation" onClick={() => setMobileMenuOpen((open) => !open)}><Menu size={19} /></button><button className="icon-button" aria-label="Buscar" aria-expanded={searchOpen} onClick={() => { setSearchOpen((open) => !open); setSearchQuery(''); }}><Search size={19} /></button><button className="icon-button notification-button" aria-label={`Notificações${notificationUnread ? `, ${notificationUnread} não lidas` : ''}`} aria-expanded={notificationOpen} aria-haspopup="dialog" onClick={() => { setNotificationOpen((open) => !open); refreshNotifications(); }}><Bell size={19} />{notificationUnread > 0 && <span className="notification-count">{notificationUnread > 99 ? '99+' : notificationUnread}</span>}</button><Avatar initials={initials || "—"} color="teal" online />{notificationOpen && <section className="notification-panel" role="dialog" aria-label="Central de notificações"><header><div><b>Notificações</b><span>{notificationUnread ? `${notificationUnread} não lidas` : 'Atualizadas com os dados do workspace'}</span></div><button type="button" className="notification-mark-read" onClick={markNotificationsRead} disabled={!notificationUnread}>Marcar como lidas</button></header>{notificationError ? <div className="notification-state error" role="alert"><span>{notificationError}</span><button type="button" onClick={refreshNotifications}>Tentar novamente</button></div> : notificationLoading ? <div className="notification-state">Carregando notificações...</div> : notificationItems.length === 0 ? <div className="notification-state"><Bell size={21} /><b>Tudo em dia</b><span>Quando houver atualizações em clientes, projetos, tarefas ou cobranças, elas aparecerão aqui.</span></div> : <div className="notification-list">{notificationItems.map((item) => <button type="button" className={`notification-item ${item.unread ? 'unread' : ''}`} key={item.id} onClick={() => { setActiveNav(item.page); setNotificationOpen(false); }}><span className="notification-item-dot" /><span className="notification-item-copy"><b>{item.title}</b><span>{item.detail}</span><small>{new Date(item.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</small></span><ArrowRight size={15} /></button>)}</div>}</section>}{searchOpen && <div className="quick-search-panel"><label><Search size={15} /><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar uma área do Nexo" /></label>{navGroups.flatMap((group) => group.items).filter((item) => !searchQuery || item.label.toLocaleLowerCase('pt-BR').includes(searchQuery.toLocaleLowerCase('pt-BR'))).slice(0, 8).map((item) => <button type="button" key={item.label} onClick={() => { setActiveNav(item.label); setMobileMenuOpen(false); setSearchOpen(false); }}>{item.label}<ArrowRight size={14} /></button>)}</div>}</div>
        </header>

        <div className="page-content">
          {activeNav === 'Meu Dia' ? <main className="dashboard-view">
          <div className="welcome-row">
            <div><p className="eyebrow">{dashboardDate.toLocaleUpperCase('pt-BR')}</p><h1>Meu dia</h1><p className="welcome-subtitle">Aqui está o que merece sua atenção hoje.</p></div>
            <div className="dashboard-create-wrap"><button className="primary-button" aria-expanded={createOpen} onClick={() => setCreateOpen((open) => !open)}><Plus size={17} /> Criar novo <ChevronDown size={15} /></button>{createOpen && <div className="dashboard-create-menu" role="menu">{[['Lead', 'Leads'], ['Projeto', 'Projetos'], ['Tarefa', 'Tarefas'], ['Reunião', 'Agenda'], ['Cobrança', 'Cobranças']].map(([label, page]) => <button type="button" role="menuitem" key={page} onClick={() => { setActiveNav(page); setCreateOpen(false); }}>{label}<ArrowRight size={14} /></button>)}</div>}</div>
          </div>

          <section className="stats-grid" aria-label="Resumo">
            <StatCard title="Leads" value={String(sourceLeads.length)} change="" detail="oportunidades no pipeline" icon={Users} tone="green" />
            <StatCard title="Projetos" value={String(activeProjects.length)} change="" detail="em andamento" icon={FolderKanban} tone="blue" />
            <StatCard title="A receber" value={upcomingAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} change="" detail="próximos 30 dias" icon={CircleDollarSign} tone="green" />
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
              {visibleLeads.slice(0, 4).map((lead) => <LeadCard key={lead.id} lead={lead} onAction={() => handleLeadAction(lead)} onMore={() => handleLeadAction({ ...lead, action: 'Abrir oportunidade' })} />)}
              {visibleLeads.length === 0 && <div className="empty-filter">Nenhum lead nesta origem por enquanto.</div>}
            </div>
            </section>
            <div className="tasks-area">
              <div className="section-heading task-heading"><div className="section-title-group"><h2>Tarefas de hoje</h2><span className="count-pill">{tasks.filter((task) => task.state !== 'Concluída').length} tarefas</span></div><div className="task-tabs">{['Todas', 'Em andamento', 'Pendente', 'Concluída'].map((item) => <button key={item} className={taskFilter === item ? 'selected' : ''} aria-pressed={taskFilter === item} onClick={() => setTaskFilter(item)}>{item}</button>)}</div></div>
              <div className="task-grid">
                {visibleTasks.slice(0, 4).map((task) => <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task.id)} onOpen={() => { setActiveNav('Tarefas'); }} />)}
                {visibleTasks.length === 0 && <div className="empty-filter">Nenhuma tarefa com vencimento hoje. Crie uma tarefa ou consulte todas em Tarefas.</div>}
              </div>
            </div>
            </div>
            {chatOpen && <aside className={`attention-panel ${chatExpanded ? 'expanded' : ''}`} aria-label="Painel de atendimento">
              <div className="attention-header"><div><span className="online-dot" /><h2>Atendimento</h2><span className="online-label">Online agora</span></div><div className="panel-controls"><button aria-label="Expandir atendimento" onClick={() => setChatExpanded(!chatExpanded)}><ArrowUpRight size={16} /></button><button aria-label="Fechar atendimento" onClick={() => setChatOpen(false)}><X size={16} /></button></div></div>
              <div className="attention-empty"><Inbox size={24} /><b>Nenhuma conversa registrada</b><span>Conecte o WhatsApp ou abra a caixa de entrada para começar.</span><button onClick={() => setActiveNav('Integrações')}>Ver integrações</button></div>
            </aside>}
          </section>

          {dashboardError && <div className="dashboard-data-error" role="alert"><span>{dashboardError}</span><button type="button" onClick={refreshDashboard}>Tentar novamente</button></div>}

          <section className={`bottom-alerts ${chatOpen ? '' : 'chat-closed'}`}>
            <button className="alert-card" onClick={() => setActiveNav('Cobranças')}><span className="alert-icon red-bg"><CircleDollarSign size={18} /></span><span><b>Cobranças vencidas</b><small>{overdueBills.length ? `${overdueBills.length} aguardando pagamento` : 'Nenhuma cobrança vencida'}</small></span><span className="alert-count red-count">{overdueBills.length}</span><ChevronRight size={17} /></button>
            <button className="alert-card" onClick={() => setActiveNav('Propostas')}><span className="alert-icon blue-bg"><FileText size={18} /></span><span><b>Propostas pendentes</b><small>{dashboardRecords.proposals.filter((item) => !['Aprovada', 'Recusada', 'accepted', 'rejected'].includes(item.status)).length ? 'Aguardando retorno de clientes' : 'Nenhuma proposta pendente'}</small></span><span className="alert-count blue-count">{dashboardRecords.proposals.filter((item) => !['Aprovada', 'Recusada', 'accepted', 'rejected'].includes(item.status)).length}</span><ChevronRight size={17} /></button>
            <button className="alert-card" onClick={() => setActiveNav('Agenda')}><span className="alert-icon blue-bg"><CalendarDays size={18} /></span><span><b>Eventos de hoje</b><small>{todayEvents.length ? `${todayEvents.length} compromisso${todayEvents.length === 1 ? '' : 's'} na agenda` : 'Nenhum compromisso agendado'}</small></span><span className="alert-count blue-count">{todayEvents.length}</span><ChevronRight size={17} /></button>
          </section>
          </main> : <ModuleScreen page={activeNav} />}
        </div>
      </section>
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
    </div>
  );
}

export default function App() {
  if (window.location.pathname.startsWith('/portal/')) return <PublicClientPortal slug={window.location.pathname.split('/').filter(Boolean).at(-1)} />;
  if (window.location.pathname === '/privacy') return <PublicLegalPage type="privacy" />;
  if (window.location.pathname === '/terms') return <PublicLegalPage type="terms" />;
  return <WorkspaceAccess><WorkspaceShell /></WorkspaceAccess>;
}

function StatCard({ title, value, change, detail, icon: Icon, tone, negative = false }) {
  return <article className="stat-card"><span className={`stat-icon ${tone}`}><Icon size={19} strokeWidth={1.9} /></span><div className="stat-content"><span className="stat-title">{title}</span><strong>{value}</strong><span className="stat-foot"><span className={negative ? 'change negative' : 'change'}>{negative ? <ArrowUpRight size={13} /> : <ArrowUpRight size={13} />}{change}</span><small>{detail}</small></span></div></article>;
}

function LeadCard({ lead, onAction, onMore }) {
  const SourceIcon = lead.icon === 'instagram' ? Instagram : lead.icon === 'site' ? FolderKanban : lead.icon === 'ads' ? Activity : Users;
  return <article className="lead-card"><div className="lead-card-top"><Avatar initials={lead.initials} color={lead.color} /><button className="more-button" aria-label={`Abrir oportunidade de ${lead.name}`} onClick={onMore}><MoreVertical size={17} /></button></div><h3>{lead.name}</h3><p className="lead-company">{lead.company}</p><span className={`source-tag ${lead.icon}`}><SourceIcon size={12} />{lead.source}</span><p className="lead-service">{lead.service}</p><p className="lead-note">{lead.note}</p><button className={`lead-action ${lead.actionType}`} onClick={onAction}>{lead.action}<span><ArrowRight size={15} /></span></button></article>;
}

function TaskCard({ task, onToggle, onOpen }) {
  const done = task.state === 'Concluída';
  return <article className={`task-card ${task.featured ? 'featured' : ''} ${done ? 'done' : ''}`}>
    <div className="task-time"><span>{task.time}</span><span className="today-pill">Hoje</span><div className="task-avatar-stack"><Avatar initials={task.initials} color={task.initials === 'MS' ? 'rose' : task.initials === 'TM' ? 'amber' : 'blue'} small />{task.featured && <Avatar initials="GS" color="teal" small />}</div></div>
    <button className="task-title-button" onClick={onOpen}><h3>{task.title}</h3></button><p className="task-company"><BriefcaseBusiness size={13} />{task.company}</p><p className="task-detail">{task.detail}</p>
    <div className="task-card-footer"><button className={`task-state ${done ? 'completed' : task.featured ? 'in-progress' : ''}`} onClick={onToggle}>{done ? <Check size={13} /> : <Clock3 size={13} />}{task.state}</button><button className="task-open" aria-label={`Abrir ${task.title}`} onClick={onOpen}><ChevronRight size={19} /></button></div>
  </article>;
}
