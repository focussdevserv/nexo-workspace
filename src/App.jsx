import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Sentry from '@sentry/react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness,
  CalendarDays, Check, CheckSquare, ChevronDown, ChevronRight, CircleDollarSign,
  Clock3, FileText, FolderKanban, House, Inbox, Instagram, LayoutDashboard,
  Mail, MessageCircle, Menu, MoreVertical, Paperclip, Phone, Plus, Search, Send,
  Settings, Sparkles, Users, Video, X,
} from 'lucide-react';
const CommercialScreen = lazy(() => import('./screens/CommercialScreens.jsx'));
const WorkScreen = lazy(() => import('./screens/WorkScreens.jsx'));
const ServiceScreen = lazy(() => import('./screens/ServiceScreens.jsx'));
const AdminScreen = lazy(() => import('./screens/AdminScreens.jsx'));
import { PublicClientPortal } from './screens/ClientPortalScreens.jsx';
import WorkspaceAccess from './screens/WorkspaceAccess.jsx';
import PublicLegalPage from './screens/PublicLegalPages.jsx';
import { apiRequest, fetchAllRecords } from './lib/workspace-api.js';
import { publishWorkspacePreferences, readCachedWorkspacePreferences, useWorkspacePreferences } from './lib/workspace-preferences.js';
import { purgeFictitiousLocalData } from './lib/demo-data.js';
import './screens/forms-polish.css';
import './screens/buttons-polish.css';
import './screens/onboarding.css';

purgeFictitiousLocalData();

const commercialPages = new Set(['CRM', 'Leads', 'Pipeline', 'Clientes', 'Empresas', 'Contatos', 'Propostas', 'Serviços', 'Contratos']);
const workPages = new Set(['Agenda', 'Tarefas', 'Aprovações', 'Projetos', 'Horas', 'Arquivos']);
const servicePages = new Set(['Financeiro', 'Receitas', 'Despesas', 'Contas', 'Cobranças', 'Assinaturas', 'Caixa de entrada', 'WhatsApp', 'Tickets', 'Sites', 'Domínios', 'Hospedagens', 'Monitoramento', 'Integrações', 'Automações']);
const adminPages = new Set(['Equipe', 'Relatórios', 'Metas', 'Configurações', 'Portal do cliente', 'Repositórios']);

function ModuleScreen({ page, navigationContext, onNavigationContextConsumed }) {
  if (commercialPages.has(page)) return <Suspense fallback={<ModuleLoading />}><CommercialScreen key={page} page={page} navigationContext={navigationContext} onNavigationContextConsumed={onNavigationContextConsumed} /></Suspense>;
  if (workPages.has(page)) return <Suspense fallback={<ModuleLoading />}><WorkScreen key={page} page={page} navigationContext={navigationContext} onNavigationContextConsumed={onNavigationContextConsumed} /></Suspense>;
  if (servicePages.has(page)) return <Suspense fallback={<ModuleLoading />}><ServiceScreen key={page} page={page} navigationContext={navigationContext} onNavigationContextConsumed={onNavigationContextConsumed} /></Suspense>;
  if (adminPages.has(page)) return <Suspense fallback={<ModuleLoading />}><AdminScreen key={page} page={page} navigationContext={navigationContext} onNavigationContextConsumed={onNavigationContextConsumed} /></Suspense>;
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

const memberWorkspacePages = new Set(['Meu Dia', 'Agenda', 'Tarefas', 'Caixa de entrada', 'Aprova\u00e7\u00f5es', 'Projetos', 'Arquivos', 'Tickets']);
function navigationPermissionModule(page) {
  const groupIndex = navGroups.findIndex((group) => group.items.some((item) => item.label === page));
  const group = navGroups[groupIndex];
  const itemIndex = group?.items.findIndex((item) => item.label === page) ?? -1;
  if (groupIndex === 0) return itemIndex >= 3 ? 'support' : itemIndex > 0 ? 'delivery' : null;
  if (groupIndex === 1) return 'crm';
  if (groupIndex === 2) return 'delivery';
  if (groupIndex === 3 || groupIndex === 6) return 'support';
  if (groupIndex === 4) return 'sites';
  if (groupIndex === 5) return 'finance';
  if (groupIndex === 7) return 'team';
  if (groupIndex === 8) return itemIndex === 0 ? 'automations' : 'integrations';
  if (groupIndex === 9) return itemIndex < 2 ? 'reports' : 'settings';
  return null;
}
function roleCanOpenPage(role, page, permissions = null) {
  if (page === navGroups[7]?.items[0]?.label) return role === 'owner';
  if (role === 'owner') return true;
  const module = navigationPermissionModule(page);
  const explicitRead = module && permissions?.[module]?.read;
  if (typeof explicitRead === 'boolean') return explicitRead;
  return role !== 'member' || memberWorkspacePages.has(page);
}
function storedWorkspaceUser() { try { return JSON.parse(sessionStorage.getItem('nexo.api.user') || 'null'); } catch { return null; } }
function savedWorkspacePage() { try { return sessionStorage.getItem('nexo.workspace.activePage'); } catch { return null; } }

function Avatar({ initials, color = 'blue', small = false, online = false }) {
  return <span className={`avatar avatar-${color} ${small ? 'avatar-small' : ''} ${online ? 'avatar-online' : ''}`}>{initials}</span>;
}

function ModuleLoading() {
  return <div className="module-loading" role="status" aria-live="polite">Carregando módulo...</div>;
}

function ModuleErrorFallback({ resetError }) {
  return <section className="module-load-error" role="alert">
    <span className="eyebrow">NEXO / MODULO</span>
    <h2>Nao foi possivel abrir esta tela</h2>
    <p>O restante do workspace continua disponivel. Tente novamente ou abra outra area pelo menu.</p>
    <button className="primary-button" type="button" onClick={resetError}>Tentar novamente</button>
  </section>;
}

function FirstRunSetup({ onNavigate, notify }) {
  const [snapshot, setSnapshot] = useState({ loading: true, error: '', profile: false, service: false, client: false, kickoff: false, integration: false, skipKickoff: false, skipIntegrations: false, completed: false, record: null });
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const refresh = useCallback(async () => {
    setSnapshot((current) => ({ ...current, loading: true, error: '' }));
    const [settingsResult, clientsResult, servicesResult, projectsResult, proposalsResult, integrationsResult] = await Promise.allSettled([
      fetchAllRecords('/api/workspace/settings'), fetchAllRecords('/api/workspace/clients'), fetchAllRecords('/api/workspace/services'),
      fetchAllRecords('/api/workspace/projects'), fetchAllRecords('/api/workspace/proposals'), apiRequest('/api/integrations/status'),
    ]);
    const failed = [settingsResult, clientsResult, servicesResult, projectsResult, proposalsResult].find((result) => result.status === 'rejected');
    if (failed) { setSnapshot((current) => ({ ...current, loading: false, error: failed.reason?.message || 'Não foi possível conferir os primeiros passos.' })); return; }
    const records = settingsResult.value;
    const preferences = records.find((item) => item.key === 'workspace-preferences')?.settings || {};
    const profile = Boolean(String(preferences.workspace?.agency || preferences.workspace?.fiscalName || '').trim());
    const clients = clientsResult.value;
    const services = servicesResult.value;
    const projectRows = projectsResult.value;
    const proposalRows = proposalsResult.value;
    const integrationRows = integrationsResult.status === 'fulfilled' ? integrationsResult.value.data || [] : [];
    const progressRecord = records.find((item) => item.key === 'first-run-onboarding') || null;
    const progress = progressRecord?.progress || {};
    const next = {
      loading: false, error: '', profile, service: services.length > 0, client: clients.length > 0,
      kickoff: projectRows.length > 0 || proposalRows.length > 0,
      integration: integrationRows.some((item) => item.enabled && item.lastTestStatus === 'connected'),
      skipKickoff: Boolean(progress.skipKickoff), skipIntegrations: Boolean(progress.skipIntegrations),
      completed: Boolean(progress.completedAt), record: progressRecord,
    };
    setSnapshot(next);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const persistProgress = async (record, progress) => {
    setBusy(true);
    try {
      const payload = { key: 'first-run-onboarding', progress, updatedAt: new Date().toISOString() };
      if (record) await apiRequest(`/api/workspace/settings/${record.id}`, { method: 'PATCH', body: JSON.stringify({ data: payload }) });
      else await apiRequest('/api/workspace/settings', { method: 'POST', body: JSON.stringify({ data: payload }) });
      await refresh();
    } catch (error) { notify(error.message || 'Não foi possível salvar o progresso inicial.'); }
    finally { setBusy(false); }
  };
  const skip = (field) => persistProgress(snapshot.record, { ...(snapshot.record?.progress || {}), [field]: true });
  const readyToComplete = !snapshot.loading && !snapshot.error && !snapshot.completed && snapshot.profile && snapshot.service && snapshot.client && (snapshot.kickoff || snapshot.skipKickoff) && (snapshot.integration || snapshot.skipIntegrations);
  useEffect(() => {
    if (!readyToComplete || busy) return;
    persistProgress(snapshot.record, { ...(snapshot.record?.progress || {}), completedAt: new Date().toISOString() });
  }, [readyToComplete, busy, snapshot.record]);
  if (snapshot.loading) return <section className="first-run-setup" aria-busy="true"><span className="first-run-kicker">PRIMEIROS PASSOS</span><b>Verificando seu workspace…</b></section>;
  if (snapshot.error) return <section className="first-run-setup first-run-error" role="alert"><div><b>Vamos preparar seu workspace</b><p>{snapshot.error}</p></div><button type="button" className="first-run-secondary" onClick={refresh}>Tentar novamente</button></section>;
  if (snapshot.completed || collapsed) return snapshot.completed ? null : <button className="first-run-reopen" type="button" onClick={() => setCollapsed(false)}>Retomar configuração inicial <ArrowRight size={15} /></button>;
  const steps = [
    { id: 'profile', title: 'Perfil da agência', detail: 'Nome e dados usados em propostas e contratos.', done: snapshot.profile, page: 'Configurações', context: { settingsSection: 'agency' }, action: 'Configurar perfil' },
    { id: 'service', title: 'Primeiro serviço', detail: 'Confira o catálogo e configure preço ou modalidade.', done: snapshot.service, page: 'Serviços', action: 'Abrir catálogo' },
    { id: 'client', title: 'Primeiro cliente', detail: 'Cadastre pessoa física, empresa ou ambos.', done: snapshot.client, page: 'Clientes', action: 'Cadastrar cliente' },
    { id: 'kickoff', title: 'Projeto ou proposta', detail: 'Inicie o primeiro trabalho quando estiver pronto.', done: snapshot.kickoff || snapshot.skipKickoff, page: 'Projetos', optional: !snapshot.kickoff, skipField: 'skipKickoff', action: 'Criar projeto' },
    { id: 'integration', title: 'Conectar um canal', detail: 'Google, pagamentos e WhatsApp podem ser conectados depois.', done: snapshot.integration || snapshot.skipIntegrations, page: 'Integrações', optional: !snapshot.integration, skipField: 'skipIntegrations', action: 'Ver integrações' },
  ];
  const finished = steps.filter((step) => step.done).length;
  return <section className="first-run-setup" aria-labelledby="first-run-title">
    <div className="first-run-header"><div><span className="first-run-kicker">COMECE POR AQUI</span><h2 id="first-run-title">Deixe o Nexo pronto para sua rotina</h2><p>Os dados ficam salvos enquanto você avança. Nenhuma cobrança será criada por este assistente.</p></div><div className="first-run-progress"><b>{finished} de {steps.length}</b><span>etapas</span></div></div>
    <div className="first-run-track" aria-hidden="true"><i style={{ width: `${Math.round(finished / steps.length * 100)}%` }} /></div>
    <div className="first-run-steps">{steps.map((step, index) => <article className={`first-run-step ${step.done ? 'done' : ''}`} key={step.id}><span className="first-run-step-number">{step.done ? <Check size={15} /> : index + 1}</span><div className="first-run-step-copy"><b>{step.title}{step.optional && <small>Opcional</small>}</b><p>{step.detail}</p><div className="first-run-step-actions">{!step.done && <button type="button" className="first-run-primary" onClick={() => onNavigate(step.page, step.context)}>{step.action}<ArrowRight size={14} /></button>}{step.optional && !step.done && <button type="button" className="first-run-skip" disabled={busy} onClick={() => skip(step.skipField)}>Pular esta etapa</button>}</div></div></article>)}</div>
    <footer><span>{busy ? 'Salvando progresso…' : 'Pode sair e continuar depois. As etapas concluídas são detectadas automaticamente.'}</span><button type="button" className="first-run-skip" onClick={() => setCollapsed(true)}>Lembrar mais tarde</button></footer>
  </section>;
}

function readLocalValue(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }
function amountValue(value) { return Number(String(value || '').replace(/[^\d,]/g, '').replace(',', '.')) || 0; }
function workspacePageSlug(label) { return label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function workspacePageFromPath(pathname) {
  if (!pathname.startsWith('/app/')) return null;
  const slug = decodeURIComponent(pathname.slice('/app/'.length)).replace(/\/+$/, '');
  return navGroups.flatMap((group) => group.items).find((item) => workspacePageSlug(item.label) === slug)?.label || null;
}

function normalizedTaskStatus(task) {
  return String(task?.state || task?.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isCompletedTask(task) {
  return ['concluida', 'concluido', 'completed', 'done'].includes(normalizedTaskStatus(task));
}

function WorkspaceShell() {
  const currentUser = storedWorkspaceUser();
  const preferences = useWorkspacePreferences();
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.darkMode ? 'dark' : 'light';
    document.documentElement.style.colorScheme = preferences.darkMode ? 'dark' : 'light';
  }, [preferences.darkMode]);
  const hadExplicitPageAtStartup = useRef(Boolean(workspacePageFromPath(window.location.pathname) || savedWorkspacePage()));
  const didNavigateAtStartup = useRef(false);
  const [activeNav, setActiveNav] = useState(() => {
    const user = storedWorkspaceUser();
    const role = user?.role;
    const routedPage = workspacePageFromPath(window.location.pathname);
    if (routedPage && roleCanOpenPage(role, routedPage, user?.permissions)) return routedPage;
    try {
      const savedPage = sessionStorage.getItem('nexo.workspace.activePage');
      if (navGroups.some((group) => group.items.some((item) => item.label === savedPage)) && roleCanOpenPage(role, savedPage, user?.permissions)) return savedPage;
      const startPage = readCachedWorkspacePreferences().startPage;
      return roleCanOpenPage(role, startPage, user?.permissions) ? startPage : 'Meu Dia';
    } catch { return 'Meu Dia'; }
  });
  const pageTitle = activeNav;
  useEffect(() => {
    document.title = `Nexo · ${pageTitle}`;
  }, [pageTitle]);
  const [navigationContext, setNavigationContext] = useState(null);
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

  useEffect(() => {
    let active = true;
    apiRequest('/api/workspace/preferences').then((result) => {
      if (!active) return;
      const next = publishWorkspacePreferences(result.data);
      if (!hadExplicitPageAtStartup.current && !didNavigateAtStartup.current && roleCanOpenPage(currentUser?.role, next.startPage, currentUser?.permissions)) setActiveNav(next.startPage);
    }).catch(() => {});
    return () => { active = false; };
  }, [currentUser?.role]);

  const refreshDashboard = useCallback(async () => {
    try {
      const isMember = storedWorkspaceUser()?.role === 'member';
      const [leads, projects, loadedTasks, events, proposals, bills] = await Promise.all([
        isMember ? Promise.resolve([]) : fetchAllRecords('/api/workspace/leads'), fetchAllRecords('/api/workspace/projects'), fetchAllRecords('/api/workspace/tasks'),
        fetchAllRecords('/api/workspace/events'), isMember ? Promise.resolve([]) : fetchAllRecords('/api/workspace/proposals'), isMember ? Promise.resolve([]) : fetchAllRecords('/api/billing/orders'),
      ]);
      setDashboardRecords({ leads, projects, events, proposals, bills });
      setTasks(loadedTasks.map((task) => ({ ...task, state: task.state || task.status || 'Pendente', company: task.company || task.client || '', time: task.time || '', detail: task.description || task.detail || '' })));
      setDashboardError('');
    } catch (error) { setDashboardError(error.message || 'Não foi possível atualizar o resumo.'); }
  }, []);

  const refreshNotifications = useCallback(async () => {
    try {
      const result = await apiRequest('/api/notifications');
      setNotificationItems(Array.isArray(result.data) ? result.data.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) : []);
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

  const openNotification = async (item) => {
    if (item.unread) {
      try {
        const result = await apiRequest('/api/notifications/read', { method: 'POST', body: JSON.stringify({ notificationId: item.id }) });
        const readAt = new Date(result.data.readAt).getTime();
        const updated = notificationItems.map((notification) => ({ ...notification, unread: notification.unread && new Date(notification.createdAt).getTime() > readAt }));
        setNotificationItems(updated);
        setNotificationUnread(updated.filter((notification) => notification.unread).length);
      } catch (error) {
        setNotificationError(error.message || 'Não foi possível marcar esta notificação como lida.');
        return;
      }
    }
    setActiveNav(item.page);
    setNotificationOpen(false);
  };

  useEffect(() => {
    refreshDashboard();
    const clock = window.setInterval(() => setNow(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })), 60_000);
    return () => window.clearInterval(clock);
  }, [refreshDashboard]);

  useEffect(() => {
    refreshNotifications();
    const timer = window.setInterval(refreshNotifications, 10_000);
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
      const user = storedWorkspaceUser();
      if (page && roleCanOpenPage(user?.role, page, user?.permissions)) setActiveNav(page);
      else { window.history.replaceState({ nexo: true }, '', '/app/meu-dia'); setActiveNav('Meu Dia'); }
    };
    window.addEventListener('popstate', restoreRoute);
    return () => window.removeEventListener('popstate', restoreRoute);
  }, []);

  useEffect(() => {
    const navigate = (event) => { const detail = typeof event.detail === 'string' ? { page: event.detail, context: null } : event.detail; const user = storedWorkspaceUser(); if (detail?.page && navGroups.some((group) => group.items.some((item) => item.label === detail.page)) && roleCanOpenPage(user?.role, detail.page, user?.permissions)) { didNavigateAtStartup.current = true; setActiveNav(detail.page); setNavigationContext(detail.context || null); setMobileMenuOpen(false); } };
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

  const visibleNavGroups = navGroups.map((group) => ({ ...group, items: group.items.filter((item) => roleCanOpenPage(currentUser?.role, item.label, currentUser?.permissions)) })).filter((group) => group.items.length > 0);
  const initials = (currentUser?.name || '').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const dateChip = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' }).format(today);

  const todaysTasks = useMemo(() => tasks.filter((task) => String(task.dueAt || task.dueDate || task.due || '').slice(0, 10) === todayIso), [tasks, todayIso]);
  const visibleTasks = useMemo(() => {
    if (taskFilter === 'Em andamento') return todaysTasks.filter((task) => normalizedTaskStatus(task) === 'em andamento');
    if (taskFilter === 'Pendente') return todaysTasks.filter((task) => ['pendente', 'a fazer', 'aberta', 'novo'].includes(normalizedTaskStatus(task)));
    if (taskFilter === 'Concluída') return todaysTasks.filter(isCompletedTask);
    return preferences.showCompleted ? todaysTasks : todaysTasks.filter((task) => !isCompletedTask(task));
  }, [taskFilter, todaysTasks, preferences.showCompleted]);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const toggleTask = async (id) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    const state = isCompletedTask(task) ? 'Pendente' : 'Concluída';
    try { const result = await apiRequest(`/api/workspace/tasks/${id}`, { method: 'PATCH', body: JSON.stringify({ data: { state, status: state } }) }); setTasks((current) => current.map((item) => item.id === id ? { ...item, ...result.data, state } : item)); }
    catch (error) { setDashboardError(error.message || 'Não foi possível atualizar a tarefa.'); }
  };

  const handleLeadAction = (lead) => { const destination = /proposta/i.test(lead.action) ? 'Propostas' : /reunião|agendar|apresentação/i.test(lead.action) ? 'Agenda' : 'Pipeline'; setActiveNav(destination); notify(`${lead.name} · abrindo ${destination.toLowerCase()}`); };

  return (
    <div className={"app-shell " + (preferences.compact ? 'is-compact' : '')}>
      <aside id="workspace-mobile-navigation" className={`side-nav ${mobileMenuOpen ? 'mobile-open' : ''}`} aria-label="Navegação principal">
        <button className="side-brand" aria-label="Nexo início" onClick={() => { didNavigateAtStartup.current = true; setActiveNav('Meu Dia'); setMobileMenuOpen(false); }}>
          <span className="brand-glyph"><i /><b /><em /></span><strong>nexo</strong>
        </button>
        <nav className="side-nav-scroll">
          {visibleNavGroups.map((group) => <div className="nav-group" key={group.label}>
            <span className="nav-group-title">{group.label}</span>
            {group.items.map(({ label, icon: Icon }) => <button key={label} className={`side-nav-link ${activeNav === label ? 'active' : ''}`} onClick={() => { didNavigateAtStartup.current = true; setActiveNav(label); setMobileMenuOpen(false); }} aria-current={activeNav === label ? 'page' : undefined} aria-label={label} title={label}>
              <Icon size={16} strokeWidth={1.8} /><span>{label}</span>
            </button>)}
          </div>)}
        </nav>
        <button className="profile-shortcut" onClick={() => { didNavigateAtStartup.current = true; setActiveNav(currentUser?.role === 'member' ? 'Meu Dia' : 'Configura\u00e7\u00f5es'); }}><Avatar initials={initials || '—'} color="teal" online /><span><b>{currentUser?.name || currentUser?.email || 'Minha conta'}</b><small>{currentUser?.organizationName || 'Workspace'}</small></span><ChevronDown size={14} /></button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="day-strip">
            <div className="strip-title"><span className="strip-caption">{activeNav}</span><span className="date-chip"><CalendarDays size={13} /> {dateChip}</span></div>
            <div className={`strip-event ${todayEvents.length ? 'strip-current' : 'strip-idle'}`}><span className="time-pin">{now}</span><strong>{todayEvents[0]?.title || todayEvents[0]?.name || "Agenda livre"}</strong><span className="strip-empty">{todayEvents[0]?.time || (todayEvents[0]?.startsAt ? new Date(todayEvents[0].startsAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Sem compromissos marcados.")}</span></div>
          </div>
          {mobileMenuOpen && <button className="mobile-nav-backdrop" type="button" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} />}
          <div className="top-actions"><button className="icon-button mobile-menu-toggle" aria-label="Abrir menu" aria-expanded={mobileMenuOpen} aria-controls="workspace-mobile-navigation" onClick={() => setMobileMenuOpen((open) => !open)}><Menu size={19} /></button><button className="icon-button" aria-label="Buscar" aria-expanded={searchOpen} onClick={() => { setSearchOpen((open) => !open); setSearchQuery(''); }}><Search size={19} /></button><button className="icon-button notification-button" aria-label={`Notificações${notificationUnread ? `, ${notificationUnread} não lidas` : ''}`} aria-expanded={notificationOpen} aria-haspopup="dialog" onClick={() => { setNotificationOpen((open) => !open); refreshNotifications(); }}><Bell size={19} />{notificationUnread > 0 && <span className="notification-count">{notificationUnread > 99 ? '99+' : notificationUnread}</span>}</button><Avatar initials={initials || "—"} color="teal" online />{notificationOpen && <section className="notification-panel" role="dialog" aria-label="Central de notificações"><header><div><b>Notificações</b><span>{notificationUnread ? `${notificationUnread} não lidas` : 'Atualizadas com os dados do workspace'}</span></div><button type="button" className="notification-mark-read" onClick={markNotificationsRead} disabled={!notificationUnread}>Marcar como lidas</button></header>{notificationError ? <div className="notification-state error" role="alert"><span>{notificationError}</span><button type="button" onClick={refreshNotifications}>Tentar novamente</button></div> : notificationLoading ? <div className="notification-state">Carregando notificações...</div> : notificationItems.length === 0 ? <div className="notification-state"><Bell size={21} /><b>Tudo em dia</b><span>Quando houver atualizações em clientes, projetos, tarefas ou cobranças, elas aparecerão aqui.</span></div> : <div className="notification-list">{notificationItems.map((item) => <button type="button" className={`notification-item ${item.unread ? 'unread' : ''}`} key={item.id} onClick={() => openNotification(item)}><span className="notification-item-dot" /><span className="notification-item-copy"><b>{item.title}</b><span>{item.detail}</span><small>{new Date(item.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</small></span><ArrowRight size={15} /></button>)}</div>}</section>}{searchOpen && <div className="quick-search-panel"><label><Search size={15} /><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar uma área do Nexo" /></label>{navGroups.flatMap((group) => group.items).filter((item) => !searchQuery || item.label.toLocaleLowerCase('pt-BR').includes(searchQuery.toLocaleLowerCase('pt-BR'))).slice(0, 8).map((item) => <button type="button" key={item.label} onClick={() => { setActiveNav(item.label); setMobileMenuOpen(false); setSearchOpen(false); }}>{item.label}<ArrowRight size={14} /></button>)}</div>}</div>
        </header>

        <div className="page-content">
          {activeNav === 'Meu Dia' ? <main className="dashboard-view">
          <div className="welcome-row">
            <div><p className="eyebrow">{dashboardDate.toLocaleUpperCase('pt-BR')}</p><h1>Meu dia</h1><p className="welcome-subtitle">Aqui está o que merece sua atenção hoje.</p></div>
            <div className="dashboard-create-wrap"><button className="primary-button" aria-expanded={createOpen} onClick={() => setCreateOpen((open) => !open)}><Plus size={17} /> Criar novo <ChevronDown size={15} /></button>{createOpen && <div className="dashboard-create-menu" role="menu">{(currentUser?.role === 'member' ? [['Tarefa', 'Tarefas'], ['Reuniao', 'Agenda']] : [['Lead', 'Leads'], ['Projeto', 'Projetos'], ['Tarefa', 'Tarefas'], ['Reuniao', 'Agenda'], ['Cobranca', 'Cobr\u00e7as']]).map(([label, page]) => <button type="button" role="menuitem" key={page} onClick={() => { setActiveNav(page); setCreateOpen(false); }}>{label}<ArrowRight size={14} /></button>)}</div>}</div>
          </div>

          {currentUser?.role !== 'member' && <FirstRunSetup notify={notify} onNavigate={(page, context) => { if (roleCanOpenPage(currentUser?.role, page, currentUser?.permissions)) { setActiveNav(page); setNavigationContext(context || null); } }} />}
          {currentUser?.role === 'member' ? <section className="stats-grid" aria-label="Resumo">
            <StatCard title="Projetos" value={String(activeProjects.length)} change="" detail="em andamento" icon={FolderKanban} tone="blue" />
            <StatCard title="Tarefas de hoje" value={String(todaysTasks.filter((task) => !isCompletedTask(task)).length)} change="" detail="pendentes" icon={CheckSquare} tone="green" />
            <StatCard title="Eventos de hoje" value={String(todayEvents.length)} change="" detail="na agenda" icon={CalendarDays} tone="blue" />
          </section> : <section className="stats-grid" aria-label="Resumo">
            <StatCard title="Leads" value={String(sourceLeads.length)} change="" detail="oportunidades no pipeline" icon={Users} tone="green" />
            <StatCard title="Projetos" value={String(activeProjects.length)} change="" detail="em andamento" icon={FolderKanban} tone="blue" />
            <StatCard title="A receber" value={upcomingAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} change="" detail="proximos 30 dias" icon={CircleDollarSign} tone="green" />
            <StatCard title="Atrasadas" value={String(overdueBills.length)} change="" detail="cobrancas em atraso" icon={Clock3} tone="red" negative />
          </section>}

          <section className={`dashboard-grid ${chatOpen ? '' : 'chat-closed'}`}>
            <div className="dashboard-main">
            {currentUser?.role !== 'member' && (
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
            )}
            <div className="tasks-area">
              <div className="section-heading task-heading"><div className="section-title-group"><h2>Tarefas de hoje</h2><span className="count-pill">{todaysTasks.filter((task) => !isCompletedTask(task)).length} abertas hoje</span></div><div className="task-tabs">{['Todas', 'Em andamento', 'Pendente', 'Concluída'].map((item) => <button key={item} className={taskFilter === item ? 'selected' : ''} aria-pressed={taskFilter === item} onClick={() => setTaskFilter(item)}>{item}</button>)}</div></div>
              <div className="task-grid">
              {visibleTasks.slice(0, 4).map((task) => <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task.id)} onOpen={() => { setNavigationContext({ taskId: task.id }); setActiveNav('Tarefas'); }} />)}
                {visibleTasks.length === 0 && <div className="empty-filter">Nenhuma tarefa com vencimento hoje. Crie uma tarefa ou consulte todas em Tarefas.</div>}
              </div>
            </div>
            </div>
            {chatOpen && <aside className={`attention-panel ${chatExpanded ? 'expanded' : ''}`} aria-label="Painel de atendimento">
              <div className="attention-header"><div><span className="online-dot" /><h2>Atendimento</h2><span className="online-label">Online agora</span></div><div className="panel-controls"><button aria-label="Expandir atendimento" onClick={() => setChatExpanded(!chatExpanded)}><ArrowUpRight size={16} /></button><button aria-label="Fechar atendimento" onClick={() => setChatOpen(false)}><X size={16} /></button></div></div>
              <div className="attention-empty"><Inbox size={24} /><b>Nenhuma conversa registrada</b><span>Abra a caixa de entrada para continuar o atendimento.</span><button onClick={() => setActiveNav("Caixa de entrada")}>Abrir caixa de entrada</button></div>
            </aside>}
          </section>

          {dashboardError && <div className="dashboard-data-error" role="alert"><span>{dashboardError}</span><button type="button" onClick={refreshDashboard}>Tentar novamente</button></div>}

          <section className={`bottom-alerts ${chatOpen ? '' : 'chat-closed'}`}>
            {currentUser?.role !== 'member' && <button className="alert-card" onClick={() => { setNavigationContext({ filter: 'overdue' }); setActiveNav('Cobranças'); }}><span className="alert-icon red-bg"><CircleDollarSign size={18} /></span><span><b>Cobranças vencidas</b><small>{overdueBills.length ? `${overdueBills.length} aguardando pagamento` : 'Nenhuma cobrança vencida'}</small></span><span className="alert-count red-count">{overdueBills.length}</span><ChevronRight size={17} /></button>}
            {currentUser?.role !== 'member' && <button className="alert-card" onClick={() => setActiveNav('Propostas')}><span className="alert-icon blue-bg"><FileText size={18} /></span><span><b>Propostas pendentes</b><small>{dashboardRecords.proposals.filter((item) => !['Aprovada', 'Recusada', 'accepted', 'rejected'].includes(item.status)).length ? 'Aguardando retorno de clientes' : 'Nenhuma proposta pendente'}</small></span><span className="alert-count blue-count">{dashboardRecords.proposals.filter((item) => !['Aprovada', 'Recusada', 'accepted', 'rejected'].includes(item.status)).length}</span><ChevronRight size={17} /></button>}
            <button className="alert-card" onClick={() => setActiveNav('Agenda')}><span className="alert-icon blue-bg"><CalendarDays size={18} /></span><span><b>Eventos de hoje</b><small>{todayEvents.length ? `${todayEvents.length} compromisso${todayEvents.length === 1 ? '' : 's'} na agenda` : 'Nenhum compromisso agendado'}</small></span><span className="alert-count blue-count">{todayEvents.length}</span><ChevronRight size={17} /></button>
          </section>
          </main> : <Sentry.ErrorBoundary fallback={ModuleErrorFallback} key={activeNav}><ModuleScreen page={activeNav} navigationContext={navigationContext} onNavigationContextConsumed={() => setNavigationContext(null)} /></Sentry.ErrorBoundary>}
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
  const done = isCompletedTask(task);
  return <article className={`task-card ${task.featured ? 'featured' : ''} ${done ? 'done' : ''}`}>
    <div className="task-time"><span>{task.time}</span><span className="today-pill">Hoje</span><div className="task-avatar-stack"><Avatar initials={task.initials} color={task.initials === 'MS' ? 'rose' : task.initials === 'TM' ? 'amber' : 'blue'} small />{task.featured && <Avatar initials="GS" color="teal" small />}</div></div>
    <button className="task-title-button" onClick={onOpen}><h3>{task.title}</h3></button><p className="task-company"><BriefcaseBusiness size={13} />{task.company}</p><p className="task-detail">{task.detail}</p>
    <div className="task-card-footer"><button className={`task-state ${done ? 'completed' : task.featured ? 'in-progress' : ''}`} onClick={onToggle}>{done ? <Check size={13} /> : <Clock3 size={13} />}{task.state}</button><button className="task-open" aria-label={`Abrir ${task.title}`} onClick={onOpen}><ChevronRight size={19} /></button></div>
  </article>;
}
