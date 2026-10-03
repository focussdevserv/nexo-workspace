import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Sentry from '@sentry/react';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness,
  CalendarDays, Check, CheckSquare, ChevronDown, ChevronRight, CircleDollarSign,
  Clock3, FileText, FolderKanban, House, Inbox, Instagram, LayoutDashboard,
  LogOut, Mail, MessageCircle, Menu, MoreVertical, Paperclip, Phone, Plus, RefreshCw, Search, Send,
  Settings, Sparkles, Sun, Moon, Users, Video, X,
} from 'lucide-react';
const CommercialScreen = lazy(() => import('./screens/CommercialScreens.jsx'));
const WorkScreen = lazy(() => import('./screens/WorkScreens.jsx'));
const ServiceScreen = lazy(() => import('./screens/ServiceScreens.jsx'));
const AdminScreen = lazy(() => import('./screens/AdminScreens.jsx'));
import { PublicClientPortal } from './screens/ClientPortalScreens.jsx';
import WorkspaceAccess from './screens/WorkspaceAccess.jsx';
import PublicLegalPage from './screens/PublicLegalPages.jsx';
import { apiRequest, fetchAllRecords } from './lib/workspace-api.js';
import { applyWorkspaceTheme, mergeServerWorkspacePreferences, publishWorkspacePreferences, readCachedWorkspacePreferences, rememberWorkspaceThemePreference, useWorkspacePreferences } from './lib/workspace-preferences.js';
import { purgeFictitiousLocalData } from './lib/demo-data.js';
import { activateLocalDemo, exitLocalDemo, isLocalDemoActive, resetLocalDemo } from './lib/local-demo.js';
import { completeTaskOccurrence } from './lib/task-recurrence.js';
import { dashboardTaskCompletionBlocker } from './lib/dashboard-task-completion.js';
import { taskDependencyBlockMessage } from './lib/task-dependency.js';
import { shouldRefreshDashboardOnNavigation } from './lib/dashboard-navigation.js';
import { dashboardCreateContext } from './lib/dashboard-create-context.js';
import { dashboardEventNavigationContext } from './lib/dashboard-event-navigation.js';
import { dashboardMetricNavigation } from './lib/dashboard-metric-navigation.js';
import { notificationNavigationTarget } from './lib/notification-navigation.js';
import { filterDashboardTasks } from './lib/dashboard-task-filter.js';
import { filterDashboardActiveProjects } from './lib/dashboard-active-projects.js';
import { dashboardMetricPresentation } from './lib/dashboard-metric-presentation.js';
import { dashboardBillingMetrics } from './lib/dashboard-billing-metrics.js';
import { selectDashboardHighlightedEvent } from './lib/dashboard-highlighted-event.js';
import { dashboardInboxConversations } from './lib/dashboard-inbox.js';
import { dashboardCalendarDayQuery, mergeDashboardCalendarEvents } from './lib/dashboard-calendar-events.js';
import { dashboardCalendarError } from './lib/dashboard-calendar-error.js';
import { dashboardLayoutStorageKey, defaultDashboardLayout, readDashboardLayout, writeDashboardLayout } from './lib/dashboard-layout-preferences.js';
import { calendarDateInTimeZone, calendarDateKeyForValue, calendarDateKeyInTimeZone, calendarTimeInTimeZone } from './lib/calendar-preferences.js';
import { isWithinWorkspaceQuietHours, shouldSendActivityBrowserAlert, taskReminderCandidates } from './lib/browser-alerts.js';
import { dispatchBeforeWorkspaceNavigation, workspaceRouteDestination } from './lib/navigation-guards.js';
import { logoutWorkspace } from './lib/workspace-session.js';
import { shouldInterceptWorkspaceLink } from './lib/workspace-navigation-link.js';
import { roleCanOpenWorkspacePage as roleCanOpenPage } from './lib/workspace-page-access.js';
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
  return <div className="module-screen-shell"><header className="module-page-header"><div><span className="eyebrow">FOCUSSHUB · WORKSPACE</span><h1>{page}</h1><p>Organize esta área da sua agência em um só lugar.</p></div></header></div>;
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
    { label: 'CRM', icon: Users },
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
const allWorkspacePageLabels = new Set([...navGroups.flatMap((group) => group.items.map((item) => item.label)), ...commercialPages]);

const memberWorkspacePages = new Set(['Meu Dia', 'Agenda', 'Tarefas', 'Caixa de entrada', 'Aprova\u00e7\u00f5es', 'Projetos', 'Arquivos', 'Tickets']);
function storedWorkspaceUser() { try { return JSON.parse(sessionStorage.getItem('nexo.api.user') || 'null'); } catch { return null; } }
function savedWorkspacePage() { try { return sessionStorage.getItem('nexo.workspace.activePage'); } catch { return null; } }

function Avatar({ initials, color = 'blue', small = false, online = false }) {
  return <span className={`avatar avatar-${color} ${small ? 'avatar-small' : ''} ${online ? 'avatar-online' : ''}`}>{initials}</span>;
}

function ModuleLoading() {
  return <div className="module-loading" role="status" aria-live="polite">Carregando módulo…</div>;
}

function recoverFromStaleModuleAssets(error) {
  const message = String(error?.message || error || '');
  if (!/Unable to preload CSS|Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk .* failed/i.test(message)) return;

  const entryAsset = document.querySelector('script[type="module"][src]')?.getAttribute('src') || window.location.pathname;
  const recoveryKey = `focusshub:stale-module-recovery:${entryAsset}`;
  try {
    if (window.sessionStorage.getItem(recoveryKey)) return;
    window.sessionStorage.setItem(recoveryKey, '1');
    window.location.reload();
  } catch {
    // If session storage is unavailable, leave the explicit reload action visible.
  }
}

function ModuleErrorFallback({ resetError }) {
  return <section className="module-load-error" role="alert">
    <span className="module-error-mark" aria-hidden="true">!</span>
    <span className="eyebrow">FOCUSSHUB · MÓDULO</span>
    <h2>Não foi possível abrir esta tela</h2>
    <p>O restante do workspace continua disponível. Tente novamente ou abra outra área pelo menu.</p>
    <div className="module-error-actions">
      <button className="primary-button" type="button" onClick={resetError}>Tentar novamente</button>
      <button className="module-error-reload" type="button" onClick={() => window.location.reload()}>Atualizar aplicativo</button>
    </div>
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
    { id: 'profile', title: 'Perfil da agência', detail: 'Dados usados em propostas e contratos.', done: snapshot.profile, page: 'Configurações', context: { settingsSection: 'agency' }, action: 'Configurar perfil' },
    { id: 'service', title: 'Primeiro serviço', detail: 'Defina serviços, preços e cobrança.', done: snapshot.service, page: 'Serviços', action: 'Abrir catálogo' },
    { id: 'client', title: 'Primeiro cliente', detail: 'Cadastre pessoas físicas ou empresas.', done: snapshot.client, page: 'Clientes', action: 'Cadastrar cliente' },
    { id: 'kickoff', title: 'Projeto ou proposta', detail: 'Comece um projeto ou envie uma proposta.', done: snapshot.kickoff || snapshot.skipKickoff, page: 'Projetos', optional: !snapshot.kickoff, skipField: 'skipKickoff', action: 'Criar projeto' },
    { id: 'integration', title: 'Conectar um canal', detail: 'Conecte Google, pagamentos ou WhatsApp.', done: snapshot.integration || snapshot.skipIntegrations, page: 'Integrações', optional: !snapshot.integration, skipField: 'skipIntegrations', action: 'Ver integrações' },
  ];
  const finished = steps.filter((step) => step.done).length;
  return <section className="first-run-setup" aria-labelledby="first-run-title">
    <div className="first-run-header"><div><span className="first-run-kicker">COMECE POR AQUI</span><h2 id="first-run-title">Deixe o Focusshub pronto para sua rotina</h2><p>Os dados ficam salvos enquanto você avança. Nenhuma cobrança será criada por este assistente.</p></div><div className="first-run-progress"><b>{finished} de {steps.length}</b><span>etapas</span></div></div>
    <div className="first-run-track" aria-hidden="true"><i style={{ width: `${Math.round(finished / steps.length * 100)}%` }} /></div>
    <div className="first-run-steps">{steps.map((step, index) => <article className={`first-run-step ${step.done ? 'done' : ''}`} key={step.id}><span className="first-run-step-number">{step.done ? <Check size={15} /> : index + 1}</span><div className="first-run-step-copy"><b>{step.title}{step.optional && <small>Opcional</small>}</b><p>{step.detail}</p><div className="first-run-step-actions">{!step.done && <button type="button" className="first-run-primary" onClick={() => onNavigate(step.page, step.context)}>{step.action}<ArrowRight size={14} /></button>}{step.optional && !step.done && <button type="button" className="first-run-skip" disabled={busy} onClick={() => skip(step.skipField)}>Pular esta etapa</button>}</div></div></article>)}</div>
    <footer><span>{busy ? 'Salvando progresso…' : 'Pode sair e continuar depois. As etapas concluídas são detectadas automaticamente.'}</span><button type="button" className="first-run-skip" onClick={() => setCollapsed(true)}>Lembrar mais tarde</button></footer>
  </section>;
}

function readLocalValue(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } }
function readDashboardLayoutSafely(key) { try { return readDashboardLayout(window.localStorage, key); } catch { return readDashboardLayout(null, key); } }
function writeDashboardLayoutSafely(key, value) { try { return writeDashboardLayout(window.localStorage, key, value); } catch { return false; } }
function workspacePageSlug(label) { return label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
function workspacePageFromPath(pathname) {
  if (!pathname.startsWith('/app/')) return null;
  let slug;
  try { slug = decodeURIComponent(pathname.slice('/app/'.length)).replace(/\/+$/, ''); }
  catch { return null; }
  return [...allWorkspacePageLabels].find((label) => workspacePageSlug(label) === slug) || null;
}

function normalizedTaskStatus(task) {
  return String(task?.state || task?.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isCompletedTask(task) {
  return ['concluida', 'concluido', 'completed', 'done'].includes(normalizedTaskStatus(task));
}

function WorkspaceShell() {
  const currentUser = storedWorkspaceUser();
  const localDemo = isLocalDemoActive();
  const preferences = useWorkspacePreferences();
  useEffect(() => {
    applyWorkspaceTheme(preferences.darkMode);
    const themeColor = document.querySelector('meta[name="theme-color"]');
    themeColor?.setAttribute('content', preferences.darkMode ? '#111412' : '#f5f6f2');
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
      if (allWorkspacePageLabels.has(savedPage) && roleCanOpenPage(role, savedPage, user?.permissions)) return savedPage;
      const startPage = readCachedWorkspacePreferences().startPage;
      return roleCanOpenPage(role, startPage, user?.permissions) ? startPage : 'Meu Dia';
    } catch { return 'Meu Dia'; }
  });
  const previousDashboardPage = useRef(activeNav);
  const pageTitle = activeNav;
  useEffect(() => {
    document.title = `Focusshub · ${pageTitle}`;
  }, [pageTitle]);
  const [navigationContext, setNavigationContext] = useState(null);
  const initialRouteSync = useRef(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [dashboardLayoutOpen, setDashboardLayoutOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [taskFilter, setTaskFilter] = useState('Todas');
  const [tasks, setTasks] = useState([]);
  const [dashboardRecords, setDashboardRecords] = useState({ leads: [], projects: [], events: [], proposals: [], bills: [], inbox: [] });
  const [dashboardGoogleCalendarEvents, setDashboardGoogleCalendarEvents] = useState([]);
  const [dashboardCalendarFailure, setDashboardCalendarFailure] = useState(null);
  const [dashboardCalendarRevision, setDashboardCalendarRevision] = useState(0);
  const dashboardCalendarRequestId = useRef(0);
  const [dashboardRestrictedSources, setDashboardRestrictedSources] = useState([]);
  const [dashboardFailedSources, setDashboardFailedSources] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const dashboardRefreshId = useRef(0);
  const [updatingTaskIds, setUpdatingTaskIds] = useState(() => new Set());
  const taskMutationLock = useRef(new Set());
  const [dashboardError, setDashboardError] = useState('');
  const dashboardLayoutKey = dashboardLayoutStorageKey(currentUser?.id);
  const [dashboardLayout, setDashboardLayout] = useState(() => readDashboardLayoutSafely(dashboardLayoutKey));
  const [chatOpen, setChatOpen] = useState(true);
  const [chatExpanded, setChatExpanded] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationItems, setNotificationItems] = useState([]);
  const [notificationPreferences, setNotificationPreferences] = useState({});
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(true);
  const [notificationError, setNotificationError] = useState('');
  const seenActivityNotifications = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [toast, setToast] = useState('');
  const [now, setNow] = useState(() => calendarTimeInTimeZone(new Date(), preferences.timezone));
  const dashboardDate = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: preferences.timezone }).format(new Date());
  const sourceLeads = dashboardRecords.leads;
  const dashboardLeads = sourceLeads.map((item) => ({ ...item, company: item.company || item.client || 'Empresa não informada', color: item.color || item.tone || 'blue', initials: item.initials || item.name?.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), note: item.note || item.notes || item.service || 'Sem observações cadastradas', action: item.action || 'Abrir oportunidade', actionType: item.actionType || 'blue' }));
  const dashboardProjects = dashboardRecords.projects;
  const dashboardBills = dashboardRecords.bills;
  const today = calendarDateInTimeZone(new Date(), preferences.timezone);
  const todayIso = calendarDateKeyInTimeZone(new Date(), preferences.timezone);
  const nextMonthDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
  const nextMonthIso = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(nextMonthDate.getDate()).padStart(2, '0')}`;
  const eventStartTime = (event) => event.time || (event.startsAt ? calendarTimeInTimeZone(event.startsAt, preferences.timezone) : '');
  const dashboardEvents = mergeDashboardCalendarEvents(dashboardRecords.events, dashboardGoogleCalendarEvents);
  const todayEvents = dashboardEvents.filter((event) => calendarDateKeyForValue(event.date || event.startsAt, preferences.timezone) === todayIso).sort((a, b) => eventStartTime(a).localeCompare(eventStartTime(b)));
  const minutesOfDay = (time) => { const [hours, minutes] = String(time || '').split(':').map(Number); return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : -1; };
  const currentMinutes = minutesOfDay(now);
  const activeTodayEvent = todayEvents.find((event) => { const start = minutesOfDay(eventStartTime(event)); return start >= 0 && currentMinutes >= start && currentMinutes < start + (Number(event.durationMinutes ?? event.duration) || 60); });
  const highlightedTodayEventState = selectDashboardHighlightedEvent(todayEvents, { now: new Date(), timeZone: preferences.timezone });
  const highlightedTodayEvent = highlightedTodayEventState.event;
  const dashboardInbox = dashboardInboxConversations(dashboardRecords.inbox, 3);
  const { overdueBills, upcomingAmount } = dashboardBillingMetrics(dashboardBills, {
    today: todayIso,
    through: nextMonthIso,
    timeZone: preferences.timezone,
  });
  const activeProjects = filterDashboardActiveProjects(dashboardProjects);
  const dashboardRestricted = (source) => dashboardRestrictedSources.includes(source);
  const restrictedWorkspaceModules = [...new Set(dashboardRestrictedSources.map((source) => ({ leads: 'CRM', projects: 'Projetos', tasks: 'Tarefas', events: 'Agenda', proposals: 'CRM', bills: 'Financeiro', inbox: 'Caixa de entrada' })[source]).filter(Boolean))];
  const deliveryPermission = currentUser?.permissions?.delivery;
  const canEditTasks = currentUser?.role === 'owner' || (deliveryPermission ? deliveryPermission.write === true : true);

  useEffect(() => {
    let active = true;
    apiRequest('/api/workspace/preferences').then((result) => {
      if (!active) return;
      setNotificationPreferences(result.data?.notifications || {});
      const next = publishWorkspacePreferences(mergeServerWorkspacePreferences(result.data));
      if (!hadExplicitPageAtStartup.current && !didNavigateAtStartup.current && roleCanOpenPage(currentUser?.role, next.startPage, currentUser?.permissions)) setActiveNav(next.startPage);
    }).catch(() => {});
    const updateNotifications = (event) => setNotificationPreferences(event.detail && typeof event.detail === 'object' ? event.detail : {});
    window.addEventListener('nexo:workspace-notifications', updateNotifications);
    return () => { active = false; window.removeEventListener('nexo:workspace-notifications', updateNotifications); };
  }, [currentUser?.role]);

  const refreshDashboard = useCallback(async () => {
    const refreshId = ++dashboardRefreshId.current;
    setDashboardCalendarRevision((revision) => revision + 1);
    setDashboardLoading(true);
    const isMember = storedWorkspaceUser()?.role === 'member';
    const sources = [
      { key: 'leads', load: isMember ? Promise.resolve([]) : fetchAllRecords('/api/workspace/leads') },
      { key: 'projects', load: fetchAllRecords('/api/workspace/projects') },
      { key: 'tasks', load: fetchAllRecords('/api/workspace/tasks') },
      { key: 'events', load: fetchAllRecords('/api/workspace/events') },
      { key: 'proposals', load: isMember ? Promise.resolve([]) : fetchAllRecords('/api/workspace/proposals') },
      { key: 'bills', load: isMember ? Promise.resolve([]) : Promise.all([
        fetchAllRecords('/api/billing/orders'),
        fetchAllRecords('/api/billing/subscriptions'),
      ]).then(([orders, subscriptions]) => [
        ...orders.map((item) => ({ ...item, billingKind: 'order' })),
        ...subscriptions.map((item) => ({ ...item, billingKind: 'subscription' })),
      ]) },
      { key: 'inbox', load: fetchAllRecords('/api/workspace/inbox') },
    ];
    const results = await Promise.all(sources.map(async ({ key, load }) => {
      try { return { key, records: await load }; }
      catch (error) { return { key, error }; }
    }));
    if (refreshId !== dashboardRefreshId.current) return;
    const permissionFailures = results.filter(({ error }) => error && (error.code === 'forbidden' || error.details?.status === 403));
    const otherFailures = results.filter(({ key, error }) => error && !permissionFailures.some((failure) => failure.key === key));
    setDashboardRestrictedSources(permissionFailures.map(({ key }) => key));
    setDashboardFailedSources(otherFailures.map(({ key }) => key));
    const next = Object.fromEntries(results.map(({ key, records }) => [key, records || []]));
    setDashboardRecords(next);
    setTasks((next.tasks || []).map((task) => ({ ...task, state: task.state || task.status || 'Pendente', company: task.company || task.client || '', time: task.time || '', detail: task.description || task.detail || '' })));
    setDashboardError(otherFailures[0]?.error?.message || '');
    setDashboardLoading(false);
  }, [localDemo]);

  useEffect(() => {
    const requestId = ++dashboardCalendarRequestId.current;
    let active = true;
    if (activeNav !== 'Meu Dia' || localDemo) {
      setDashboardGoogleCalendarEvents([]);
      setDashboardCalendarFailure(null);
      return () => { active = false; };
    }
    if (!dashboardCalendarRevision) return () => { active = false; };
    const query = dashboardCalendarDayQuery(new Date(), preferences.timezone);
    setDashboardCalendarFailure(null);
    apiRequest(`/api/integrations/google/calendar/events?${query.toString()}`)
      .then((result) => { if (active && requestId === dashboardCalendarRequestId.current) setDashboardGoogleCalendarEvents(Array.isArray(result.data) ? result.data : []); })
      .catch((error) => { if (active && requestId === dashboardCalendarRequestId.current) { setDashboardGoogleCalendarEvents([]); setDashboardCalendarFailure(dashboardCalendarError(error, currentUser?.role === 'owner')); } });
    return () => { active = false; };
  }, [activeNav, localDemo, preferences.timezone, dashboardCalendarRevision, currentUser?.role]);

  useEffect(() => {
    setDashboardLayout(readDashboardLayoutSafely(dashboardLayoutKey));
  }, [dashboardLayoutKey]);

  const toggleDashboardSection = (section) => {
    setDashboardLayout((current) => {
      const next = { ...current, [section]: !current[section] };
      writeDashboardLayoutSafely(dashboardLayoutKey, next);
      return next;
    });
  };

  const refreshNotifications = useCallback(async () => {
    try {
      const result = await apiRequest('/api/notifications');
      setNotificationItems(Array.isArray(result.data) ? result.data.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) : []);
      setNotificationUnread(result.unreadCount || 0);
      setNotificationError('');
    } catch (error) { setNotificationError(error.message || 'Não foi possível carregar as notificações.'); }
    finally { setNotificationLoading(false); }
  }, []);

  const navigateToPage = (page, context = null) => {
    const user = storedWorkspaceUser();
    if (!allWorkspacePageLabels.has(page)) return false;
    if (!roleCanOpenPage(user?.role, page, user?.permissions)) { notify(`Seu perfil não tem permissão para abrir ${page}.`); return false; }
    if (!dispatchBeforeWorkspaceNavigation(window, page, context)) return false;
    didNavigateAtStartup.current = true;
    setActiveNav(page);
    setNavigationContext(context);
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setCreateOpen(false);
    setDashboardLayoutOpen(false);
    return true;
  };

  const openDashboardMetric = (metric) => {
    const destination = dashboardMetricNavigation(metric);
    if (destination) navigateToPage(destination.page, destination.context || null);
  };

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
    const target = notificationNavigationTarget(item);
    navigateToPage(target.page, target.context);
    setNotificationOpen(false);
  };

  useEffect(() => {
    if (notificationLoading || notificationError) return;
    const items = notificationItems.filter((item) => typeof item?.id === 'string');
    if (seenActivityNotifications.current === null) {
      seenActivityNotifications.current = new Set(items.map((item) => item.id));
      return;
    }
    const seen = seenActivityNotifications.current;
    const unseen = items.filter((item) => !seen.has(item.id));
    if (!unseen.length) return;
    const options = { permission: typeof window.Notification === 'undefined' ? 'unsupported' : window.Notification.permission, visible: document.visibilityState === 'visible', now: new Date(), timeZone: preferences.timezone };
    if (notificationPreferences.browser === true && options.permission === 'granted' && !options.visible && isWithinWorkspaceQuietHours(options.now, notificationPreferences, options.timeZone)) return;
    for (const item of unseen) seen.add(item.id);
    if (localDemo || typeof window.Notification === 'undefined') return;
    for (const item of unseen) {
      if (!shouldSendActivityBrowserAlert(item, notificationPreferences, options)) continue;
      try {
        const notice = new window.Notification(item.title || 'Focusshub', { body: item.detail || 'Há uma nova atualização no workspace.', tag: `focusshub-${item.id}` });
        notice.onclick = () => {
          window.focus();
          window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: notificationNavigationTarget(item) }));
          notice.close();
        };
      } catch { /* Browser delivery can be unavailable even after permission was granted. */ }
    }
  }, [notificationItems, notificationLoading, notificationError, notificationPreferences, preferences.timezone, localDemo]);

  useEffect(() => {
    if (localDemo || !tasks.length || typeof window.Notification === 'undefined') return undefined;
    const storageKey = `focusshub.task-browser-alerts.${currentUser?.id || 'workspace'}`;
    let seen = new Set();
    try { const stored = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(stored)) seen = new Set(stored.filter((key) => typeof key === 'string')); } catch { /* Keep this session functional if storage is disabled. */ }
    const sendDueReminders = () => {
      const candidates = taskReminderCandidates(tasks, notificationPreferences, { permission: window.Notification.permission, now: new Date(), timeZone: preferences.timezone });
      for (const candidate of candidates) {
        if (seen.has(candidate.key)) continue;
        if (document.visibilityState === 'visible') continue;
        try {
          const notice = new window.Notification(candidate.title, { body: candidate.body, tag: `focusshub-${candidate.key}` });
          notice.onclick = () => {
            window.focus();
            window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: { page: candidate.page, context: { taskId: candidate.taskId } } }));
            notice.close();
          };
          seen.add(candidate.key);
          try { localStorage.setItem(storageKey, JSON.stringify([...seen].slice(-500))); } catch { /* Notification still displays in this session. */ }
        } catch { /* Browser delivery can be unavailable even after permission was granted. */ }
      }
    };
    sendDueReminders();
    document.addEventListener('visibilitychange', sendDueReminders);
    const reminderTimer = window.setInterval(sendDueReminders, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', sendDueReminders);
      window.clearInterval(reminderTimer);
    };
  }, [tasks, notificationPreferences, preferences.timezone, localDemo, currentUser?.id]);

  useEffect(() => {
    refreshDashboard();
    const updateWorkspaceClock = () => setNow(calendarTimeInTimeZone(new Date(), preferences.timezone));
    updateWorkspaceClock();
    const clock = window.setInterval(updateWorkspaceClock, 60_000);
    return () => window.clearInterval(clock);
  }, [refreshDashboard, preferences.timezone]);

  useEffect(() => {
    const previousPage = previousDashboardPage.current;
    previousDashboardPage.current = activeNav;
    if (shouldRefreshDashboardOnNavigation(previousPage, activeNav, didNavigateAtStartup.current)) refreshDashboard();
  }, [activeNav, refreshDashboard]);

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
      const canOpenPage = Boolean(page && roleCanOpenPage(user?.role, page, user?.permissions));
      const destination = workspaceRouteDestination(page, canOpenPage);
      if (!dispatchBeforeWorkspaceNavigation(window, destination)) {
        window.history.pushState({ nexo: true }, '', `/app/${workspacePageSlug(activeNav)}`);
        return;
      }
      didNavigateAtStartup.current = true;
      if (!canOpenPage) window.history.replaceState({ nexo: true }, '', `/app/${workspacePageSlug(destination)}`);
      setActiveNav(destination);
    };
    window.addEventListener('popstate', restoreRoute);
    return () => window.removeEventListener('popstate', restoreRoute);
  }, [activeNav]);

  useEffect(() => {
    const navigate = (event) => { const detail = typeof event.detail === 'string' ? { page: event.detail, context: null } : event.detail; if (detail?.page) navigateToPage(detail.page, detail.context || null); };
    window.addEventListener('nexo:navigate', navigate);
    return () => window.removeEventListener('nexo:navigate', navigate);
  }, []);

  useEffect(() => {
    const closeMenu = (event) => { if (event.key === 'Escape') { setMobileMenuOpen(false); setSearchOpen(false); setCreateOpen(false); setDashboardLayoutOpen(false); setNotificationOpen(false); } };
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
  }, [filter, dashboardLeads]);

  const visibleNavGroups = navGroups.map((group) => ({ ...group, items: group.items.filter((item) => roleCanOpenPage(currentUser?.role, item.label, currentUser?.permissions)) })).filter((group) => group.items.length > 0);
  const initials = (currentUser?.name || '').trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const dateChip = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', timeZone: preferences.timezone }).format(new Date());
  const createActions = currentUser?.role === 'member' ? [['Tarefa', 'Tarefas', 'task'], ['Reunião', 'Agenda', 'event']] : [['Lead', 'Leads', 'lead'], ['Projeto', 'Projetos', 'project'], ['Tarefa', 'Tarefas', 'task'], ['Reunião', 'Agenda', 'event'], ['Cobrança', 'Cobranças', 'billing']];
  const availableCreateActions = createActions.filter(([, page]) => roleCanOpenPage(currentUser?.role, page, currentUser?.permissions));

  const todaysTasks = useMemo(() => tasks.filter((task) => calendarDateKeyForValue(task.dueAt || task.dueDate || task.due, preferences.timezone) === todayIso), [tasks, todayIso, preferences.timezone]);
  const visibleTasks = useMemo(() => {
    return filterDashboardTasks(todaysTasks, taskFilter);
  }, [taskFilter, todaysTasks]);

  const notify = (message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  };

  const toggleTheme = async () => {
    const nextDarkMode = !preferences.darkMode;
    rememberWorkspaceThemePreference(nextDarkMode);
    const nextPreferences = publishWorkspacePreferences({ ...preferences, darkMode: nextDarkMode });
    try {
      const records = await fetchAllRecords('/api/workspace/settings');
      const existing = records.find((record) => record.key === 'workspace-preferences');
      const { timezone, weekStart, ...personalPreferences } = nextPreferences;
      const data = {
        key: 'workspace-preferences',
        settings: {
          ...(existing?.settings || {}),
          workspace: { ...(existing?.settings?.workspace || {}), timezone, weekStart },
          preferences: { ...(existing?.settings?.preferences || {}), ...personalPreferences },
        },
      };
      if (existing?.id) {
        await apiRequest(`/api/workspace/settings/${existing.id}`, { method: 'PATCH', body: JSON.stringify({ data }) });
      } else {
        await apiRequest('/api/workspace/settings', { method: 'POST', body: JSON.stringify({ data }) });
      }
    } catch { /* Keep the selected theme locally if the server is temporarily unavailable. */ }
  };

  const toggleTask = async (id) => {
    const taskKey = String(id);
    if (taskMutationLock.current.has(taskKey)) return;
    const task = tasks.find((item) => String(item.id) === String(id));
    if (!task) return;
    const blocker = dashboardTaskCompletionBlocker(tasks, task);
    if (blocker) { notify(taskDependencyBlockMessage(blocker)); return; }
    const reopening = isCompletedTask(task);
    const state = reopening ? 'Pendente' : 'Conclu\u00edda';
    const transition = completeTaskOccurrence(tasks, id);
    const occurrence = reopening ? null : transition.occurrence;
    taskMutationLock.current.add(taskKey);
    setUpdatingTaskIds((current) => new Set(current).add(taskKey));
    try {
      if (occurrence && !localDemo) {
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...nextOccurrence } = occurrence;
        const completed = await apiRequest(`/api/workspace/tasks/${encodeURIComponent(id)}/complete-occurrence`, { method: 'POST', body: JSON.stringify({ patch: { state, status: state }, nextOccurrence }) });
        setTasks((current) => {
          const withoutOccurrence = current.filter((item) => String(item.id) !== String(completed.data.nextOccurrence.id));
          return withoutOccurrence.map((item) => String(item.id) === String(id) ? { ...item, ...completed.data.task } : item).concat(completed.data.nextOccurrence);
        });
        notify(`Tarefa concluída. Próxima ocorrência criada para ${new Date(`${occurrence.due}T12:00:00`).toLocaleDateString('pt-BR')}.`);
        return;
      }
      const result = await apiRequest(`/api/workspace/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ data: { state, status: state } }) });
      const savedTask = { ...task, ...result.data, state, status: state };
      setTasks((current) => current.map((item) => String(item.id) === String(id) ? savedTask : item));
      if (occurrence) {
        try {
          const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = occurrence;
          const nextResult = await apiRequest('/api/workspace/tasks', { method: 'POST', body: JSON.stringify({ data: { ...data, state: 'A fazer', status: 'A fazer' } }) });
          setTasks((current) => current.some((item) => String(item.recurrenceId || item.id) === String(occurrence.recurrenceId) && Number(item.recurrenceSequence || 1) === Number(occurrence.recurrenceSequence)) ? current : [{ ...occurrence, ...nextResult.data }, ...current]);
          notify(`Tarefa conclu\u00edda. Pr\u00f3xima ocorr\u00eancia criada para ${new Date(`${occurrence.due}T12:00:00`).toLocaleDateString('pt-BR')}.`);
        } catch (error) {
          setDashboardError(`Tarefa concluida, mas a proxima ocorrencia nao foi criada. Abra Tarefas e crie a proxima data manualmente. ${error.message || ''}`.trim());
        }
      }
    } catch (error) {
      setDashboardError(error.message || 'Nao foi possivel atualizar a tarefa.');
    } finally {
      taskMutationLock.current.delete(taskKey);
      setUpdatingTaskIds((current) => { const next = new Set(current); next.delete(taskKey); return next; });
    }
  };

  const handleLeadAction = (lead) => {
    const destination = /proposta/i.test(lead.action) ? 'Propostas' : /reunião|agendar|apresentação/i.test(lead.action) ? 'Agenda' : 'Leads';
    const context = destination === 'Leads' ? { leadId: lead.id } : null;
    if (navigateToPage(destination, context)) notify(`${lead.name} · abrindo ${destination.toLowerCase()}`);
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutWorkspace({ request: apiRequest, storage: sessionStorage });
      window.location.assign('/');
    } catch (error) {
      notify(error.message || 'Não foi possível encerrar a sessão. Tente novamente.');
      setLoggingOut(false);
    }
  };

  return (
    <div className={"app-shell " + (preferences.compact ? 'is-compact' : '')}>
      <a className="skip-link" href="#main-content">Pular para o conteúdo principal</a>
      <aside id="workspace-mobile-navigation" className={`side-nav ${mobileMenuOpen ? 'mobile-open' : ''}`} aria-label="Navegação principal">
        <a className="side-brand" aria-label="Focusshub início" href="/app/meu-dia" onClick={(event) => { if (!shouldInterceptWorkspaceLink(event)) return; event.preventDefault(); navigateToPage('Meu Dia'); }}>
          <span className="brand-glyph"><i /><b /><em /></span><strong>Focusshub</strong>
        </a>
        {mobileMenuOpen && <button className="side-nav-close" type="button" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)}><X size={18} /></button>}
        <nav className="side-nav-scroll">
          {visibleNavGroups.map((group) => <div className="nav-group" key={group.label}>
            <span className="nav-group-title">{group.label}</span>
            {group.items.map(({ label, icon: Icon }) => { const selected = label === 'CRM' ? commercialPages.has(activeNav) : activeNav === label; return <a key={label} href={`/app/${workspacePageSlug(label)}`} className={`side-nav-link ${selected ? 'active' : ''}`} onClick={(event) => { if (!shouldInterceptWorkspaceLink(event)) return; event.preventDefault(); navigateToPage(label); }} aria-current={selected ? 'page' : undefined} aria-label={label} title={label}>
              <Icon size={16} strokeWidth={1.8} /><span>{label}</span>
            </a>; })}
          </div>)}
        </nav>
        {!localDemo && <button className="side-nav-link" type="button" onClick={() => { activateLocalDemo(); window.location.reload(); }} aria-label="Explorar Focusshub com dados fictícios" title="Demonstração local"><Sparkles size={16} strokeWidth={1.8} /><span>Explorar demonstração</span></button>}
        <button className="profile-shortcut" onClick={() => navigateToPage(currentUser?.role === 'member' ? 'Meu Dia' : 'Configura\u00e7\u00f5es')}><Avatar initials={initials || '—'} color="teal" online /><span><b>{currentUser?.name || currentUser?.email || 'Minha conta'}</b><small>{currentUser?.organizationName || 'Workspace'}</small></span><ChevronDown size={14} /></button>
        {!localDemo && <button className="side-nav-link" type="button" onClick={handleLogout} disabled={loggingOut} aria-label="Sair da conta" title="Sair da conta"><LogOut size={16} strokeWidth={1.8} /><span>{loggingOut ? 'Encerrando sessão...' : 'Sair da conta'}</span></button>}
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="day-strip">
            <div className="strip-title"><span className="strip-caption">{activeNav}</span><span className="date-chip"><CalendarDays size={13} /> {dateChip}</span></div>
            <button type="button" className={`strip-event ${highlightedTodayEventState.status === 'active' ? 'strip-current' : 'strip-idle'}`} aria-label={highlightedTodayEvent ? `Abrir ${highlightedTodayEvent.title || highlightedTodayEvent.name || 'compromisso'} na Agenda` : 'Abrir Agenda'} onClick={() => { const context = highlightedTodayEvent && dashboardEventNavigationContext(highlightedTodayEvent); navigateToPage('Agenda', context); }}><span className="time-pin">{highlightedTodayEventState.status === 'active' ? 'Em andamento' : highlightedTodayEventState.status === 'upcoming' ? 'Próximo' : highlightedTodayEventState.status === 'all-day' ? 'Dia inteiro' : highlightedTodayEventState.status === 'unscheduled' ? 'Sem horário' : `Agora ${now}`}</span><strong>{highlightedTodayEvent?.title || highlightedTodayEvent?.name || "Agenda livre"}</strong>{!highlightedTodayEvent && <span className="strip-empty">Sem compromissos marcados.</span>}</button>
          </div>
          {mobileMenuOpen && <button className="mobile-nav-backdrop" type="button" aria-label="Fechar menu" onClick={() => setMobileMenuOpen(false)} />}
          <div className="top-actions"><button className="icon-button mobile-menu-toggle" aria-label={mobileMenuOpen ? "Menu de navega\u00e7\u00e3o aberto" : "Abrir menu"} aria-expanded={mobileMenuOpen} aria-controls="workspace-mobile-navigation" onClick={() => setMobileMenuOpen((open) => !open)}><Menu size={19} /></button><button className="icon-button" aria-label="Buscar" aria-expanded={searchOpen} onClick={() => { setSearchOpen((open) => !open); setSearchQuery(''); }}><Search size={19} /></button><button className="icon-button theme-toggle-button" type="button" aria-label={preferences.darkMode ? 'Ativar modo claro' : 'Ativar modo escuro'} title={preferences.darkMode ? 'Ativar modo claro' : 'Ativar modo escuro'} onClick={toggleTheme}>{preferences.darkMode ? <Sun size={19} /> : <Moon size={19} />}</button><button className="icon-button notification-button" aria-label={`Notificações${notificationUnread ? `, ${notificationUnread} não lidas` : ''}`} aria-expanded={notificationOpen} aria-haspopup="dialog" onClick={() => { setNotificationOpen((open) => !open); refreshNotifications(); }}><Bell size={19} />{notificationUnread > 0 && <span className="notification-count">{notificationUnread > 99 ? '99+' : notificationUnread}</span>}</button><Avatar initials={initials || "—"} color="teal" online />{notificationOpen && <section className="notification-panel" role="dialog" aria-label="Central de notificações"><header><div><b>Notificações</b><span>{notificationUnread ? `${notificationUnread} não lidas` : 'Atualizadas com os dados do workspace'}</span></div><button type="button" className="notification-mark-read" onClick={markNotificationsRead} disabled={!notificationUnread}>Marcar como lidas</button></header>{notificationError ? <div className="notification-state error" role="alert"><span>{notificationError}</span><button type="button" onClick={refreshNotifications}>Tentar novamente</button></div> : notificationLoading ? <div className="notification-state">Carregando notificações...</div> : notificationItems.length === 0 ? <div className="notification-state"><Bell size={21} /><b>Tudo em dia</b><span>Quando houver atualizações em clientes, projetos, tarefas ou cobranças, elas aparecerão aqui.</span></div> : <div className="notification-list">{notificationItems.map((item) => <button type="button" className={`notification-item ${item.unread ? 'unread' : ''}`} key={item.id} onClick={() => openNotification(item)}><span className="notification-item-dot" /><span className="notification-item-copy"><b>{item.title}</b><span>{item.detail}</span><small>{new Date(item.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</small></span><ArrowRight size={15} /></button>)}</div>}</section>}{searchOpen && <div className="quick-search-panel"><label><Search size={15} /><input autoFocus value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Buscar no Focusshub" /></label>{navGroups.flatMap((group) => group.items).filter((item) => roleCanOpenPage(currentUser?.role, item.label, currentUser?.permissions) && (!searchQuery || item.label.toLocaleLowerCase('pt-BR').includes(searchQuery.toLocaleLowerCase('pt-BR')))).slice(0, 8).map((item) => <button type="button" key={item.label} onClick={() => navigateToPage(item.label)}>{item.label}<ArrowRight size={14} /></button>)}</div>}</div>
        </header>

        {localDemo && <div className="local-demo-banner" role="status"><span><Sparkles size={15}/><b>Modo de demonstração local</b><small>Dados fictícios salvos só neste navegador. Nenhum serviço externo ou cobrança real é acionado.</small></span><div><button type="button" onClick={() => { resetLocalDemo(); window.location.reload(); }}>Restaurar exemplos</button><button type="button" onClick={() => { exitLocalDemo(); window.location.assign('/'); }}>Sair da demonstração</button></div></div>}
        <div className="page-content" id="main-content" tabIndex={-1}>
          {activeNav === 'Meu Dia' ? <main className="dashboard-view">
          <div className="welcome-row">
            <div><p className="eyebrow">{dashboardDate.toLocaleUpperCase('pt-BR')}</p><h1>Meu dia</h1><p className="welcome-subtitle">Aqui está o que merece sua atenção hoje.</p></div>
            <div className="dashboard-header-actions">
              <button type="button" className="dashboard-refresh-button" onClick={refreshDashboard} disabled={dashboardLoading} aria-label="Atualizar Meu Dia"><RefreshCw size={16} className={dashboardLoading ? 'is-spinning' : ''} />{dashboardLoading ? 'Atualizando' : 'Atualizar'}</button>
              <div className="dashboard-create-wrap"><button className="primary-button" aria-expanded={createOpen} aria-haspopup="menu" onClick={() => { setCreateOpen((open) => !open); setDashboardLayoutOpen(false); }}><Plus size={17} /> Criar novo <ChevronDown size={15} /></button>{createOpen && <div className="dashboard-create-menu" role="menu">{availableCreateActions.map(([label, page, action]) => <button type="button" role="menuitem" key={page} onClick={() => { const intentId = globalThis.crypto?.randomUUID?.() || `dashboard-create-${Date.now()}`; navigateToPage(page, dashboardCreateContext(action, intentId)); }}>{label}<ArrowRight size={14} /></button>)}</div>}</div>
              <div className="dashboard-create-wrap"><button type="button" className="dashboard-refresh-button" aria-label="Personalizar Meu Dia" aria-expanded={dashboardLayoutOpen} aria-haspopup="menu" onClick={() => { setDashboardLayoutOpen((open) => !open); setCreateOpen(false); }}><Settings size={16} />Personalizar</button>{dashboardLayoutOpen && <div className="dashboard-create-menu" role="menu" aria-label="Seções visíveis no Meu Dia" style={preferences.darkMode ? { background: '#1b1d22', borderColor: '#34363d' } : undefined}>{[['summary', 'Indicadores'], ['leads', 'Leads'], ['tasks', 'Tarefas de hoje'], ['inbox', 'Atendimento'], ['agenda', 'Agenda de hoje'], ['alerts', 'Alertas']].map(([section, label]) => <button type="button" role="menuitemcheckbox" aria-checked={dashboardLayout[section]} key={section} onClick={() => toggleDashboardSection(section)} style={preferences.darkMode ? { background: '#1b1d22', color: '#f3f4f6' } : undefined}>{label}{dashboardLayout[section] && <Check size={14} aria-hidden="true" />}</button>)}<button type="button" role="menuitem" onClick={() => { setDashboardLayout({ ...defaultDashboardLayout }); writeDashboardLayoutSafely(dashboardLayoutKey, defaultDashboardLayout); }} style={preferences.darkMode ? { background: '#1b1d22', color: '#f3f4f6' } : undefined}>Restaurar padrão</button></div>}</div>
            </div>
          </div>

          {currentUser?.role !== 'member' && !localDemo && <FirstRunSetup notify={notify} onNavigate={(page, context) => navigateToPage(page, context)} />}
          {dashboardLayout.summary && (currentUser?.role === 'member' ? <section className="stats-grid" aria-label="Resumo">
            {(() => { const metric = dashboardMetricPresentation({ restricted: dashboardRestricted('projects'), loading: dashboardLoading, failed: dashboardFailedSources.includes('projects'), value: activeProjects.length, detail: 'em andamento', restrictedDetail: 'sem acesso a Projetos' }); return <StatCard title="Projetos" value={metric.value} change="" detail={metric.detail} icon={FolderKanban} tone="blue" onClick={() => openDashboardMetric('projects')} />; })()}
            {(() => { const metric = dashboardMetricPresentation({ restricted: dashboardRestricted('tasks'), loading: dashboardLoading, failed: dashboardFailedSources.includes('tasks'), value: todaysTasks.filter((task) => !isCompletedTask(task)).length, detail: 'pendentes', restrictedDetail: 'sem acesso a Tarefas' }); return <StatCard title="Tarefas de hoje" value={metric.value} change="" detail={metric.detail} icon={CheckSquare} tone="green" onClick={() => openDashboardMetric('tasks')} />; })()}
            {(() => { const metric = dashboardMetricPresentation({ restricted: dashboardRestricted('events'), loading: dashboardLoading, failed: dashboardFailedSources.includes('events'), value: todayEvents.length, detail: 'na agenda', restrictedDetail: 'sem acesso à Agenda' }); return <StatCard title="Eventos de hoje" value={metric.value} change="" detail={metric.detail} icon={CalendarDays} tone="blue" onClick={() => openDashboardMetric('events')} />; })()}
          </section> : <section className="stats-grid" aria-label="Resumo">
            {(() => { const metric = dashboardMetricPresentation({ restricted: dashboardRestricted('leads'), loading: dashboardLoading, failed: dashboardFailedSources.includes('leads'), value: sourceLeads.length, detail: 'oportunidades no pipeline', restrictedDetail: 'sem acesso ao CRM' }); return <StatCard title="Leads" value={metric.value} change="" detail={metric.detail} icon={Users} tone="green" onClick={() => openDashboardMetric('leads')} />; })()}
            {(() => { const metric = dashboardMetricPresentation({ restricted: dashboardRestricted('projects'), loading: dashboardLoading, failed: dashboardFailedSources.includes('projects'), value: activeProjects.length, detail: 'em andamento', restrictedDetail: 'sem acesso a Projetos' }); return <StatCard title="Projetos" value={metric.value} change="" detail={metric.detail} icon={FolderKanban} tone="blue" onClick={() => openDashboardMetric('projects')} />; })()}
            {(() => { const metric = dashboardMetricPresentation({ restricted: dashboardRestricted('bills'), loading: dashboardLoading, failed: dashboardFailedSources.includes('bills'), value: upcomingAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), detail: 'próximos 30 dias', restrictedDetail: 'sem acesso ao Financeiro' }); return <StatCard title="A receber" value={metric.value} change="" detail={metric.detail} icon={CircleDollarSign} tone="green" onClick={() => openDashboardMetric('receivables')} />; })()}
            {(() => { const metric = dashboardMetricPresentation({ restricted: dashboardRestricted('bills'), loading: dashboardLoading, failed: dashboardFailedSources.includes('bills'), value: overdueBills.length, detail: 'cobranças em atraso', restrictedDetail: 'sem acesso ao Financeiro' }); return <StatCard title="Atrasadas" value={metric.value} change="" detail={metric.detail} icon={Clock3} tone="red" negative onClick={() => openDashboardMetric('overdue')} />; })()}
          </section>)}

          <section className={`dashboard-grid ${chatOpen ? '' : 'chat-closed'}`}>
            <div className="dashboard-main">
            {dashboardLayout.leads && currentUser?.role !== 'member' && (
            <section className="leads-section">
            <div className="section-heading">
              <div className="section-title-group"><h2>Leads novos</h2><span className="count-pill">{dashboardLeads.length} cadastrados</span></div>
              <div className="lead-filters" role="tablist" aria-label="Filtrar leads">
                {['Todos', 'Site', 'Indicação', 'Instagram', 'Tráfego pago'].map((item) => <button key={item} role="tab" aria-selected={filter === item} className={filter === item ? 'selected' : ''} onClick={() => setFilter(item)}>{item}</button>)}
                <button className="filter-more" onClick={() => navigateToPage('Leads')}>Ver todos <ChevronRight size={13} /></button>
              </div>
            </div>
            <div className="lead-grid">
              {visibleLeads.slice(0, 4).map((lead) => <LeadCard key={lead.id} lead={lead} onAction={() => handleLeadAction(lead)} onMore={() => handleLeadAction({ ...lead, action: 'Abrir oportunidade' })} />)}
              {visibleLeads.length === 0 && <div className="empty-filter">{dashboardRestricted('leads') ? 'Seu perfil nao tem leitura de CRM.' : dashboardLoading ? 'Carregando leads...' : dashboardFailedSources.includes('leads') ? 'Nao foi possivel carregar os leads. Tente atualizar.' : 'Nenhum lead nesta origem por enquanto.'}</div>}
            </div>
            </section>
            )}
            {dashboardLayout.tasks && <div className="tasks-area">
              <div className="section-heading task-heading"><div className="section-title-group"><h2>Tarefas de hoje</h2><span className="count-pill">{dashboardLoading ? 'Carregando...' : `${todaysTasks.filter((task) => !isCompletedTask(task)).length} abertas hoje`}</span></div><div className="task-tabs">{['Todas', 'Em andamento', 'Pendente', 'Concluída'].map((item) => <button key={item} className={taskFilter === item ? 'selected' : ''} aria-pressed={taskFilter === item} onClick={() => setTaskFilter(item)}>{item}</button>)}<button className="task-view-all" onClick={() => navigateToPage('Tarefas')}>Ver todas <ChevronRight size={13}/></button></div></div>
              <div className="task-grid">
              {visibleTasks.slice(0, 3).map((task) => <TaskCard key={task.id} task={task} canToggle={canEditTasks && !dashboardRestricted('tasks') && !dashboardLoading} busy={updatingTaskIds.has(task.id)} onToggle={() => toggleTask(task.id)} onOpen={() => navigateToPage('Tarefas', { taskId: task.id })} />)}
                {visibleTasks.length === 0 && <div className="empty-filter">{dashboardRestricted('tasks') ? 'Seu perfil nao tem leitura de Tarefas.' : dashboardLoading ? 'Carregando tarefas de hoje...' : dashboardFailedSources.includes('tasks') ? 'Nao foi possivel carregar as tarefas. Tente atualizar.' : 'Nenhuma tarefa com vencimento hoje. Crie uma tarefa ou consulte todas em Tarefas.'}</div>}
              </div>
            </div>}
            </div>
            {dashboardLayout.inbox && chatOpen && <aside className={`attention-panel ${chatExpanded ? 'expanded' : ''}`} aria-label="Painel de atendimento">
              <div className="attention-header"><div className="attention-heading-copy"><h2>Atendimento</h2><span className="online-label">{dashboardLoading ? 'Atualizando…' : `${dashboardRecords.inbox.length} conversas`}</span></div><div className="panel-controls"><button aria-label="Expandir atendimento" onClick={() => setChatExpanded(!chatExpanded)}><ArrowUpRight size={16} /></button><button aria-label="Fechar atendimento" onClick={() => setChatOpen(false)}><X size={16} /></button></div></div>
              {dashboardRestricted('inbox') ? <div className="attention-empty"><Inbox size={24} /><b>Caixa de entrada restrita</b><span>Seu perfil não tem acesso às conversas deste workspace.</span></div> : dashboardLoading && !dashboardRecords.inbox.length ? <div className="attention-empty" aria-live="polite">Carregando conversas…</div> : dashboardFailedSources.includes('inbox') ? <div className="attention-empty" role="alert"><Inbox size={24} /><b>Não foi possível carregar conversas</b><span>Verifique o acesso e tente atualizar o Meu Dia.</span><button type="button" onClick={refreshDashboard}>Tentar novamente</button></div> : dashboardInbox.length ? <div className="attention-demo-list"><span className="attention-demo-label">Conversas recentes</span>{dashboardInbox.map((message) => <button type="button" className="attention-demo-message" key={message.id} onClick={() => navigateToPage('Caixa de entrada', { conversationId: message.id, channel: message.channel === 'E-mail' ? 'E-mail' : 'WhatsApp', intentId: globalThis.crypto?.randomUUID?.() || `dashboard-inbox-${Date.now()}` })}><span className="attention-demo-avatar">{(message.name || message.contactName || message.from || 'C').split(/\s+/).map((part) => part[0]).slice(0, 2).join('')}</span><span><b>{message.name || message.contactName || message.from || 'Contato'}</b><small>{message.text || message.lastMessage || message.subject || 'Abrir conversa'}</small></span><time>{message.time || ''}</time></button>)}<button type="button" className="attention-demo-open" onClick={() => navigateToPage('Caixa de entrada')}>Abrir caixa de entrada <ChevronRight size={14}/></button></div> : <div className="attention-empty"><Inbox size={24} /><b>Nenhuma conversa registrada</b><span>As conversas disponíveis aparecerão aqui.</span><button type="button" onClick={() => navigateToPage('Caixa de entrada')}>Abrir caixa de entrada</button></div>}
            </aside>}{dashboardLayout.inbox && !chatOpen && <button type="button" className="attention-reopen" onClick={() => setChatOpen(true)}><Inbox size={16} /> Reabrir atendimento</button>}
          </section>

          {dashboardLayout.agenda && <section className="dashboard-agenda" aria-labelledby="dashboard-agenda-title">
            <div className="dashboard-agenda-heading">
              <div><h2 id="dashboard-agenda-title">Agenda de hoje</h2><span className="count-pill">{dashboardLoading ? 'Carregando…' : `${todayEvents.length} ${todayEvents.length === 1 ? 'compromisso' : 'compromissos'}`}</span></div>
              <button type="button" onClick={() => navigateToPage('Agenda')}>Abrir agenda <ArrowRight size={15} /></button>
            </div>
            {dashboardCalendarFailure && <div className="dashboard-calendar-error" role="status"><div><b>{dashboardCalendarFailure.title}</b><span>{dashboardCalendarFailure.detail}</span></div>{dashboardCalendarFailure.action && <button type="button" onClick={() => dashboardCalendarFailure.action === 'authorize' ? window.location.assign('/api/integrations/google/authorize') : dashboardCalendarFailure.action === 'retry' ? refreshDashboard() : navigateToPage('Integrações')}>{dashboardCalendarFailure.actionLabel}</button>}</div>}
            {dashboardRestricted('events') ? <p className="dashboard-agenda-empty">Seu perfil não tem acesso à Agenda.</p> : dashboardLoading ? <p className="dashboard-agenda-empty" aria-live="polite">Carregando compromissos…</p> : dashboardFailedSources.includes('events') ? <div className="dashboard-agenda-error" role="alert">Não foi possível carregar os compromissos. <button type="button" onClick={refreshDashboard} disabled={dashboardLoading}>Tentar novamente</button></div> : todayEvents.length ? <ol className="dashboard-agenda-list">{todayEvents.slice(0, 5).map((event, index) => {
              const context = dashboardEventNavigationContext(event);
              const startTime = event.allDay === true ? 'Dia inteiro' : eventStartTime(event) || 'Horário não definido';
              const eventMinutes = minutesOfDay(eventStartTime(event));
              const phase = event.allDay === true ? 'Dia inteiro' : event === activeTodayEvent ? 'Em andamento' : eventMinutes < 0 ? 'Sem horário' : eventMinutes < currentMinutes ? 'Concluído' : 'Próximo';
              return <li key={event.id || `${event.title}-${index}`}><button type="button" className={`dashboard-agenda-event ${phase === 'Em andamento' ? 'is-current' : ''}`} onClick={() => context ? navigateToPage('Agenda', context) : navigateToPage('Agenda')} aria-label={`Abrir ${event.title || event.name || 'compromisso'} na Agenda`}><time>{startTime}</time><span className="dashboard-agenda-copy"><b>{event.title || event.name || 'Compromisso'}</b><small>{event.client || event.project || event.type || 'Compromisso da equipe'}</small></span><span className={`dashboard-agenda-phase ${phase === 'Em andamento' ? 'is-current' : ''}`}>{phase}</span><ChevronRight size={16} /></button></li>;
            })}</ol> : <div className="dashboard-agenda-empty"><CalendarDays size={18} /><span>Nenhum compromisso para hoje.</span><button type="button" onClick={() => navigateToPage('Agenda', dashboardCreateContext('event', globalThis.crypto?.randomUUID?.() || `dashboard-event-${Date.now()}`))}>Agendar evento <ArrowRight size={14} /></button></div>}
            {todayEvents.length > 5 && <p className="dashboard-agenda-more">+ {todayEvents.length - 5} compromissos. <button type="button" onClick={() => navigateToPage('Agenda')}>Ver todos</button></p>}
          </section>}

          {restrictedWorkspaceModules.length > 0 && <div className="dashboard-access-note" role="status">Parte do resumo foi ocultada pelo seu perfil: {restrictedWorkspaceModules.join(', ')}. Os indicadores afetados aparecem como “—”.</div>}
          {dashboardError && <div className="dashboard-data-error" role="alert"><span>{dashboardError}</span><button type="button" disabled={dashboardLoading} onClick={refreshDashboard}>{dashboardLoading ? 'Atualizando...' : 'Tentar novamente'}</button></div>}

          {dashboardLayout.alerts && <section className={`bottom-alerts ${chatOpen ? '' : 'chat-closed'}`}>
            {currentUser?.role !== 'member' && <button className="alert-card" onClick={() => { navigateToPage('Cobranças', { filter: 'overdue' }); }}><span className="alert-icon red-bg"><CircleDollarSign size={18} /></span><span><b>Cobranças vencidas</b><small>{dashboardRestricted('bills') ? 'Seu perfil não tem acesso ao Financeiro' : overdueBills.length ? `${overdueBills.length} aguardando pagamento` : 'Nenhuma cobrança vencida'}</small></span><span className="alert-count red-count">{dashboardRestricted('bills') ? '—' : overdueBills.length}</span><ChevronRight size={17} /></button>}
            {currentUser?.role !== 'member' && <button className="alert-card" onClick={() => navigateToPage('Propostas')}><span className="alert-icon blue-bg"><FileText size={18} /></span><span><b>Propostas pendentes</b><small>{dashboardRestricted('proposals') ? 'Seu perfil não tem leitura de CRM' : dashboardRecords.proposals.filter((item) => !['Aprovada', 'Recusada', 'accepted', 'rejected'].includes(item.status)).length ? 'Aguardando retorno de clientes' : 'Nenhuma proposta pendente'}</small></span><span className="alert-count blue-count">{dashboardRestricted('proposals') ? '—' : dashboardRecords.proposals.filter((item) => !['Aprovada', 'Recusada', 'accepted', 'rejected'].includes(item.status)).length}</span><ChevronRight size={17} /></button>}
            <button className="alert-card" onClick={() => navigateToPage('Agenda')}><span className="alert-icon blue-bg"><CalendarDays size={18} /></span><span><b>Eventos de hoje</b><small>{dashboardRestricted('events') ? 'Seu perfil não tem leitura da Agenda' : todayEvents.length ? `${todayEvents.length} compromisso${todayEvents.length === 1 ? '' : 's'} na agenda` : 'Nenhum compromisso agendado'}</small></span><span className="alert-count blue-count">{dashboardRestricted('events') ? '—' : todayEvents.length}</span><ChevronRight size={17} /></button>
          </section>}
          </main> : <Sentry.ErrorBoundary fallback={ModuleErrorFallback} onError={recoverFromStaleModuleAssets} key={activeNav}><ModuleScreen page={activeNav} navigationContext={navigationContext} onNavigationContextConsumed={() => setNavigationContext(null)} /></Sentry.ErrorBoundary>}
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

function StatCard({ title, value, change, detail, icon: Icon, tone, negative = false, onClick }) {
  const contents = <><span className={`stat-icon ${tone}`}><Icon size={19} strokeWidth={1.9} /></span><div className="stat-content"><span className="stat-title">{title}</span><strong>{value}</strong><span className="stat-foot"><span className={negative ? 'change negative' : 'change'}><ArrowUpRight size={13} />{change}</span><small>{detail}</small></span></div></>;
  return onClick ? <button type="button" className="stat-card stat-card-link" onClick={onClick} aria-label={`${title}: ${value}. ${detail}. Abrir detalhes`}>{contents}</button> : <article className="stat-card">{contents}</article>;
}

function LeadCard({ lead, onAction, onMore }) {
  const SourceIcon = lead.icon === 'instagram' ? Instagram : lead.icon === 'site' ? FolderKanban : lead.icon === 'ads' ? Activity : Users;
  return <article className="lead-card"><div className="lead-card-top"><Avatar initials={lead.initials} color={lead.color} /><button className="more-button" aria-label={`Abrir oportunidade de ${lead.name}`} onClick={onMore}><MoreVertical size={17} /></button></div><h3>{lead.name}</h3><p className="lead-company">{lead.company}</p><span className={`source-tag ${lead.icon}`}><SourceIcon size={12} />{lead.source}</span><p className="lead-service">{lead.service}</p><p className="lead-note">{lead.note}</p><button className={`lead-action ${lead.actionType}`} onClick={onAction}>{lead.action}<span><ArrowRight size={15} /></span></button></article>;
}

function TaskCard({ task, onToggle, onOpen, canToggle = true, busy = false }) {
  const done = isCompletedTask(task);
  return <article className={`task-card ${task.featured ? 'featured' : ''} ${done ? 'done' : ''}`}>
    <div className="task-time"><span>{task.time}</span><span className="today-pill">Hoje</span><div className="task-avatar-stack"><Avatar initials={task.initials} color={task.initials === 'MS' ? 'rose' : task.initials === 'TM' ? 'amber' : 'blue'} small />{task.featured && <Avatar initials="GS" color="teal" small />}</div></div>
    <button className="task-title-button" onClick={onOpen}><h3>{task.title}</h3></button><p className="task-company"><BriefcaseBusiness size={13} />{task.company}</p><p className="task-detail">{task.detail}</p>
    <div className="task-card-footer"><button className={`task-state ${done ? 'completed' : task.featured ? 'in-progress' : ''}`} disabled={!canToggle || busy} title={busy ? 'Salvando atualizacao...' : !canToggle ? 'Seu perfil pode ver a tarefa, mas não pode alterá-la.' : undefined} onClick={onToggle}>{done ? <Check size={13} /> : <Clock3 size={13} />}{busy ? 'Salvando...' : task.state}</button><button className="task-open" aria-label={`Abrir ${task.title}`} onClick={onOpen}><ChevronRight size={19} /></button></div>
  </article>;
}
