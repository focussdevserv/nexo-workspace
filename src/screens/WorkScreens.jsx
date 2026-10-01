import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Check,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, Clock3,
  Download, File, FileImage, FileText, Filter, Folder, FolderOpen,
  LayoutGrid, List, MoreHorizontal, Paperclip, Plus, Search, Send,
  SlidersHorizontal, Sparkles, Timer, Upload, Users, X, ShieldCheck, RefreshCw,
} from 'lucide-react';
import './work.css';
import { apiRequest, fetchAllRecords } from '../lib/workspace-api.js';
import { useWorkspacePreferences } from '../lib/workspace-preferences.js';
import { completeTaskOccurrence } from '../lib/task-recurrence.js';
import { findProjectClient } from '../lib/project-client-link.js';
import { sortFilesByName, sortFilesByRecent } from '../lib/file-sort.js';
import { downloadCsvFile, rowsToCsv } from '../lib/csv.js';

function taskIsCompleted(task) {
  const status = String(task?.state || task?.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return ['concluida', 'concluido', 'completed', 'done'].includes(status);
}

function useLocalState(key, fallback) {
  const resource = ({ 'nexo.work.projects.v1': 'projects', 'nexo.work.tasks.v1': 'tasks', 'nexo.work.events.v1': 'events', 'nexo.work.approvals.v1': 'approvals', 'nexo.work.files.v1': 'files', 'nexo.work.hours.v1': 'hours' })[key];
  const [value, setValue] = useState([]);
  const valueRef = useRef(value);
  const [syncError, setSyncError] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    fetchAllRecords(`/api/workspace/${resource}`).then((records) => { if (active) { valueRef.current = records; setValue(valueRef.current); setSyncError(''); setLoaded(true); } })
      .catch((error) => { if (active) { setSyncError(error.message || 'Falha ao carregar registros.'); setLoaded(true); window.dispatchEvent(new CustomEvent('nexo:workspace-error', { detail: error.message })); } });
    return () => { active = false; };
  }, [resource]);
  const persist = (nextOrUpdater) => {
    const previous = valueRef.current;
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(previous) : nextOrUpdater;
    valueRef.current = next; setValue(next);
    const oldById = new Map(previous.map((item) => [String(item.id), item]));
    const newById = new Map(next.map((item) => [String(item.id), item]));
    const recordData = (item) => Object.fromEntries(Object.entries(item).filter(([field]) => !['id', 'createdAt', 'updatedAt'].includes(field)));
    return Promise.all([
      ...next.filter((item) => !oldById.has(String(item.id))).map(async (item) => {
        const tempId = String(item.id);
        const saved = await apiRequest(`/api/workspace/${resource}`, { method: 'POST', body: JSON.stringify({ data: recordData(item) }) });
        valueRef.current = valueRef.current.map((row) => String(row.id) === tempId || String(row.id) === String(saved.data.id) ? saved.data : row); setValue(valueRef.current);
      }),
      ...next.filter((item) => oldById.has(String(item.id)) && JSON.stringify(recordData(item)) !== JSON.stringify(recordData(oldById.get(String(item.id))))).map((item) => apiRequest(`/api/workspace/${resource}/${item.id}`, { method: 'PATCH', body: JSON.stringify({ data: recordData(item) }) })),
      ...previous.filter((item) => !newById.has(String(item.id))).map((item) => apiRequest(`/api/workspace/${resource}/${item.id}`, { method: 'DELETE' })),
    ]).then(() => { setSyncError(''); return { ok: true, records: valueRef.current }; }).catch((error) => { if (valueRef.current === next) { valueRef.current = previous; setValue(previous); } setSyncError(error.message || 'Falha ao salvar.'); window.dispatchEvent(new CustomEvent('nexo:workspace-error', { detail: error.message })); return { ok: false, error }; });
  };
  return [value, persist, syncError, loaded];
}

const projectsSeed = [];
const tasksSeed = [];
const eventsSeed = [];
const approvalsSeed = [];
const filesSeed = [];

const screens = {
  projetos: { title: 'Projetos', description: 'Acompanhe entregas, prazos e o ritmo de cada cliente.', icon: FolderKanbanIcon },
  tarefas: { title: 'Tarefas', description: 'O próximo passo de cada projeto, sem perder o fio.', icon: CheckCircle2 },
  agenda: { title: 'Agenda', description: 'Reuniões e blocos de trabalho da equipe.', icon: CalendarDays },
  horas: { title: 'Horas', description: 'Tempo registrado por projeto e cliente.', icon: Timer },
  aprovacoes: { title: 'Aprovações', description: 'Materiais que precisam do seu olhar ou do cliente.', icon: Check },
  arquivos: { title: 'Arquivos', description: 'Materiais dos projetos em um só lugar.', icon: FolderOpen },
};

function FolderKanbanIcon(props) { return <FolderOpen {...props} />; }

function Avatar({ name, className = '' }) {
  return <span className={`work-avatar ${className}`} aria-label={name}>{name}</span>;
}
function toLocalDateInput(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function nextCalendarDate(date) { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10); }
function calendarEndDate(date, start, end) { if (end > start) return date; const next = new Date(`${date}T12:00:00`); next.setDate(next.getDate() + 1); return toLocalDateInput(next); }

function AgendaTimeGrid({ dates, events, selectedDate, now, onSelectDate, onCreateEvent, onSelectEvent, eventTone, sameDay }) {
  const firstHour = 7, lastHour = 21, hourHeight = 64;
  const keyOf = (date) => toLocalDateInput(date);
  const dayEvents = (date, allDay) => events.filter((event) => event.date === keyOf(date) && Boolean(event.time) !== allDay);
  const hasEvents = dates.some((date) => events.some((event) => event.date === keyOf(date)));
  const offset = (event) => { const [hour, minute] = event.time.split(':').map(Number); return Math.max(0, Math.min((lastHour - firstHour) * hourHeight - 30, ((hour - firstHour) * 60 + minute) / 60 * hourHeight)); };
  const height = (event) => { const [sh, sm] = event.time.split(':').map(Number); const [eh, em] = (event.end || `${String(sh + 1).padStart(2, '0')}:${String(sm).padStart(2, '0')}`).split(':').map(Number); return Math.max(34, Math.min(240, ((eh * 60 + em) - (sh * 60 + sm)) / 60 * hourHeight)); };
  return <div className={`agenda-time-grid ${dates.length === 1 ? 'is-day' : 'is-week'}`}>
    <div className="agenda-time-header"><div className="agenda-time-gutter-label">GMT−3</div>{dates.map((date) => <button type="button" key={keyOf(date)} className={`agenda-time-date ${sameDay(date, selectedDate) ? 'selected' : ''} ${sameDay(date, now) ? 'is-today' : ''}`} onClick={() => onSelectDate(date)}><span>{date.toLocaleDateString('pt-BR', { weekday: 'short' })}</span><b>{date.getDate()}</b></button>)}</div>
    <div className="agenda-all-day-row"><span>Dia todo</span>{dates.map((date) => <div key={keyOf(date)}>{dayEvents(date, true).map((event) => <button key={event.id} type="button" className={`agenda-grid-allday tone-${eventTone(event)}`} onClick={() => onSelectEvent(event)}>{event.title}</button>)}</div>)}</div>
    {!hasEvents && <div className="agenda-grid-empty"><span><CalendarDays size={17}/></span><div><b>Agenda livre</b><small>Selecione um horário na grade para criar seu próximo compromisso.</small></div><button type="button" onClick={() => onCreateEvent(selectedDate)}><Plus size={14}/> Novo evento</button></div>}
    <div className="agenda-time-scroll"><div className="agenda-time-axis">{Array.from({ length: lastHour - firstHour }, (_, i) => <span key={i}>{String(firstHour + i).padStart(2, '0')}:00</span>)}</div><div className="agenda-time-columns">{dates.map((date) => <div className={`agenda-time-column ${sameDay(date, now) ? 'is-today' : ''}`} key={keyOf(date)}><div className="agenda-time-slots">{Array.from({ length: lastHour - firstHour }, (_, i) => <button type="button" key={i} aria-label={`Criar compromisso às ${String(firstHour + i).padStart(2, '0')}:00`} onClick={() => onCreateEvent(date, `${String(firstHour + i).padStart(2, '0')}:00`)} />)}</div>{dayEvents(date, false).map((event) => <button type="button" key={event.id} className={`agenda-grid-event tone-${eventTone(event)}`} style={{ top: offset(event), height: height(event) }} onClick={() => onSelectEvent(event)}><small>{event.time}{event.end ? `–${event.end}` : ''}</small><b>{event.title}</b>{event.detail && <span>{event.detail}</span>}</button>)}</div>)}</div></div>
  </div>;
}

function AgendaCalendar({ events, selectedDate, setSelectedDate, agendaView, setAgendaView, agendaQuery, setAgendaQuery, calendarSyncBusy, calendarSyncError, calendarSyncedAt, onSyncGoogleCalendar, onSelectEvent, onCreateEvent }) {
  const monthDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const monthDays = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  const monthStart = (monthDate.getDay() + 6) % 7;
  const weekStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - ((selectedDate.getDay() + 6) % 7));
  const selectedKey = toLocalDateInput(selectedDate);
  const query = agendaQuery.trim().toLocaleLowerCase('pt-BR');
  const filteredEvents = events.filter((event) => `${event.title || ''} ${event.detail || ''} ${event.client || ''} ${event.people || ''}`.toLocaleLowerCase('pt-BR').includes(query));
  const sameDay = (a, b) => toLocalDateInput(a) === toLocalDateInput(b);
  const sortEvents = (items) => [...items].sort((a, b) => {
    const dateOrder = String(a.date || '').localeCompare(String(b.date || ''));
    return dateOrder || (a.time || '99:99').localeCompare(b.time || '99:99');
  });
  const dayEvents = sortEvents(filteredEvents.filter((event) => event.date === selectedKey));
  const movePeriod = (direction) => {
    const next = new Date(selectedDate);
    if (agendaView === 'Dia') next.setDate(next.getDate() + direction);
    else if (agendaView === 'Semana') next.setDate(next.getDate() + direction * 7);
    else {
      const day = next.getDate();
      next.setDate(1);
      next.setMonth(next.getMonth() + direction);
      next.setDate(Math.min(day, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
    }
    setSelectedDate(next);
  };
  const monthItems = (day) => filteredEvents.filter((event) => event.date === toLocalDateInput(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day)));
  const weekDate = (index) => { const date = new Date(weekStart); date.setDate(date.getDate() + index); return date; };
  const duration = (event) => {
    if (!event.time || !event.end) return 0;
    const [startHour, startMinute] = event.time.split(':').map(Number);
    const [endHour, endMinute] = event.end.split(':').map(Number);
    return Math.max(0, endHour * 60 + endMinute - startHour * 60 - startMinute);
  };
  const bookedMinutes = dayEvents.reduce((total, event) => total + duration(event), 0);
  const durationLabel = bookedMinutes ? `${Math.floor(bookedMinutes / 60)}h${bookedMinutes % 60 ? ` ${bookedMinutes % 60}min` : ''}` : '0h';
  const periodEnd = agendaView === 'Dia' ? selectedDate : agendaView === 'Semana' ? new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6) : new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
  const periodStartKey = agendaView === 'Dia' ? selectedKey : agendaView === 'Semana' ? toLocalDateInput(weekStart) : toLocalDateInput(monthDate);
  const periodEndKey = toLocalDateInput(periodEnd);
  const periodEvents = agendaView === 'Dia' ? dayEvents : filteredEvents.filter((event) => event.date >= periodStartKey && event.date <= periodEndKey);
  const visibleEvents = agendaView === 'Dia' ? dayEvents : sortEvents(periodEvents);
  const visibleMinutes = visibleEvents.reduce((total, event) => total + duration(event), 0);
  const visibleDuration = visibleMinutes ? `${Math.floor(visibleMinutes / 60)}h${visibleMinutes % 60 ? ` ${visibleMinutes % 60}min` : ''}` : '0h';
  const periodSummary = `${periodEvents.length} compromisso${periodEvents.length === 1 ? '' : 's'} · ${visibleDuration} reservado${agendaView === 'Dia' ? '' : ' no período'}`;
  const now = new Date();
  const isToday = sameDay(now, selectedDate);
  const eventTone = (event) => ['blue', 'lime', 'violet'].includes(event.color) ? event.color : 'blue';
  const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const title = agendaView === 'Mês'
    ? monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : agendaView === 'Semana'
      ? `${weekStart.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const eventDate = (date) => { const [year, month, day] = date.split('-').map(Number); return new Date(year, month - 1, day); };
  const openEvent = (event) => { setSelectedDate(eventDate(event.date)); onSelectEvent(event); };
  const monthDates = Array.from({ length: monthDays }, (_, index) => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), index + 1));
  const upcomingEvents = sortEvents(filteredEvents.filter((event) => event.date >= selectedKey)).slice(0, 4);
  const changeMiniMonth = (direction) => { const day = selectedDate.getDate(); const next = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + direction, 1); next.setDate(Math.min(day, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate())); setSelectedDate(next); };

  return <div className="agenda-workspace agenda-v2">
    <div className="agenda-toolbar agenda-toolbar-new">
      <div className="agenda-period"><button type="button" aria-label="Período anterior" onClick={() => movePeriod(-1)}><ChevronLeft size={17} /></button><div><strong>{title}</strong><small>{periodSummary}</small></div><button type="button" aria-label="Próximo período" onClick={() => movePeriod(1)}><ChevronRight size={17} /></button><button type="button" className="agenda-today" onClick={() => setSelectedDate(new Date())}>Ir para hoje</button></div>
      <div className="agenda-toolbar-tools"><button type="button" className="agenda-google-sync" onClick={onSyncGoogleCalendar} disabled={calendarSyncBusy} title={calendarSyncedAt ? `Ultima leitura: ${calendarSyncedAt}` : "Ler eventos do Google Calendar"}><RefreshCw size={14} className={calendarSyncBusy ? "agenda-spin" : ""}/><span>{calendarSyncBusy ? "Sincronizando..." : "Atualizar Google"}</span></button><div className="agenda-mode" aria-label="Visualizacao da agenda">{["Dia", "Semana", "M\u00eas"].map((mode) => <button type="button" key={mode} aria-pressed={agendaView === mode} className={agendaView === mode ? "active" : ""} onClick={() => setAgendaView(mode)}>{mode}</button>)}</div><label className="agenda-search"><Search size={15} /><input aria-label="Buscar evento ou cliente" placeholder="Buscar na agenda" value={agendaQuery} onChange={(event) => setAgendaQuery(event.target.value)} />{agendaQuery && <button type="button" aria-label="Limpar busca" onClick={() => setAgendaQuery("")}><X size={14} /></button>}</label></div>
    </div>
    <section className="agenda-main agenda-main-new agenda-main-rebuilt agenda-main-single agenda-v2-layout">
      <aside className="agenda-v2-side">
        <div className="agenda-v2-mini-head"><b>{monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</b><div><button type="button" aria-label="Mês anterior" onClick={() => changeMiniMonth(-1)}><ChevronLeft size={15}/></button><button type="button" aria-label="Próximo mês" onClick={() => changeMiniMonth(1)}><ChevronRight size={15}/></button></div></div>
        <div className="agenda-v2-mini-grid">{weekdays.map((day) => <span key={day}>{day.slice(0, 1)}</span>)}{Array.from({ length: monthStart }, (_, i) => <i key={`blank-${i}`} />)}{monthDates.map((date) => { const key = toLocalDateInput(date); const count = filteredEvents.filter((event) => event.date === key).length; return <button type="button" key={key} aria-label={`${date.toLocaleDateString('pt-BR')}${count ? `, ${count} compromissos` : ''}`} className={`${sameDay(date, selectedDate) ? 'selected' : ''} ${sameDay(date, now) ? 'is-today' : ''}`} onClick={() => setSelectedDate(date)}>{date.getDate()}{count > 0 && <i />}</button>; })}</div>
        <div className="agenda-v2-upcoming"><div className="agenda-v2-section-title"><b>Próximos</b><span>{upcomingEvents.length}</span></div>{upcomingEvents.map((event) => <button type="button" key={event.id} onClick={() => openEvent(event)}><i className={`tone-${eventTone(event)}`} /><span><b>{event.title}</b><small>{event.date === selectedKey ? 'Hoje' : eventDate(event.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {event.time || 'Dia todo'}</small></span><ChevronRight size={14}/></button>)}{!upcomingEvents.length && <p>Nenhum compromisso próximo.</p>}</div>
        <div className={`agenda-v2-connection ${calendarSyncError ? 'has-error' : ''}`}><span className="agenda-v2-connection-dot"/><div><b>{calendarSyncError ? 'Google precisa de atenção' : 'Google Calendar'}</b><small>{calendarSyncError || (calendarSyncedAt ? `Atualizado às ${calendarSyncedAt}` : 'Sincronize para buscar eventos')}</small></div></div>
      </aside>
      <div className="agenda-view-area agenda-view-area-new">
        <div className="agenda-view-heading"><div><span>{agendaView === 'Dia' ? (isToday ? 'HOJE' : 'DIA SELECIONADO') : agendaView === 'Semana' ? 'SEMANA' : 'MÊS'}</span><h3>{agendaView === 'Dia' ? (isToday ? 'Compromissos de hoje' : selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })) : agendaView === 'Semana' ? 'Sua semana' : title}</h3><small>{periodSummary}</small></div><span className="agenda-view-hint">Selecione um compromisso para ver ou editar</span></div>
        <div className="agenda-v2-stats"><div><small>{agendaView === 'Dia' ? 'Compromissos do dia' : 'Compromissos do período'}</small><b>{visibleEvents.length}</b></div><div><small>Tempo reservado</small><b>{visibleDuration}</b></div><div><small>{agendaView === 'Dia' ? 'Próximo horário' : 'Primeiro horário'}</small><b>{visibleEvents.find((event) => event.time)?.time || 'Livre'}</b></div></div>
        {calendarSyncError && <div className="agenda-sync-error" role="status"><CalendarDays size={15}/><span>{calendarSyncError}</span></div>}
        {agendaView === 'Dia' && <AgendaTimeGrid dates={[selectedDate]} events={filteredEvents} selectedDate={selectedDate} now={now} onSelectDate={setSelectedDate} onCreateEvent={onCreateEvent} onSelectEvent={onSelectEvent} eventTone={eventTone} sameDay={sameDay} />}
        {agendaView === 'Semana' && <AgendaTimeGrid dates={Array.from({ length: 7 }, (_, index) => weekDate(index))} events={filteredEvents} selectedDate={selectedDate} now={now} onSelectDate={(date) => { setSelectedDate(date); setAgendaView('Dia'); }} onCreateEvent={onCreateEvent} onSelectEvent={openEvent} eventTone={eventTone} sameDay={sameDay} />}
        {agendaView === 'Mês' && <div className="agenda-month-view agenda-month-view-new">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day, index) => <b key={day + index}>{day}</b>)}{Array.from({ length: monthStart }, (_, i) => <span key={`empty-${i}`} />)}{Array.from({ length: monthDays }, (_, i) => { const day = i + 1; const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day); const items = monthItems(day); return <button type="button" key={day} className={`${sameDay(date, selectedDate) ? 'selected' : ''} ${sameDay(date, now) ? 'is-today' : ''}`} onClick={() => { setSelectedDate(date); setAgendaView('Dia'); }}><strong>{day}</strong>{items.slice(0, 3).map((event) => <span key={event.id} className={`agenda-month-event tone-${eventTone(event)}`}>{event.time || ''} {event.title}</span>)}{items.length > 3 && <small>+{items.length - 3} outros</small>}</button>; })}</div>}
      </div>
    </section>
  </div>;
}

function WorkScreen({ page, navigationContext = null, onNavigationContextConsumed = () => {} }) {
  const preferences = useWorkspacePreferences();
  const key = normalizePage(page);
  const isMember = (() => { try { return JSON.parse(sessionStorage.getItem('nexo.api.user') || 'null')?.role === 'member'; } catch { return false; } })();
  const screen = screens[key] || screens.projetos;
  const [toast, setToast] = useState('');
  const [projectStatus, setProjectStatus] = useState('Todos');
  const [taskStatus, setTaskStatus] = useState('Todas');
  const [taskQuery, setTaskQuery] = useState('');
  const [view, setView] = useState('grid');
  const [projectQuery, setProjectQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [draggedProject, setDraggedProject] = useState(null);
  const [projects, setProjects, projectsError] = useLocalState('nexo.work.projects.v1', projectsSeed);
  const [tasks, setTasks, tasksError, tasksLoaded] = useLocalState('nexo.work.tasks.v1', tasksSeed);
  const [events, setEvents, eventsError] = useLocalState('nexo.work.events.v1', eventsSeed);
  const [approvals, setApprovals] = useLocalState('nexo.work.approvals.v1', approvalsSeed);
  const [workspaceClients, setWorkspaceClients] = useState([]);
  const [files, setFiles] = useLocalState('nexo.work.files.v1', filesSeed);
  const [hours, setHours] = useLocalState('nexo.work.hours.v1', []);
  const [hoursPeriod, setHoursPeriod] = useState('Esta semana');
  const [hoursTaskId, setHoursTaskId] = useState('');
  const [hourEditor, setHourEditor] = useState(null);
  const [hourEditDraft, setHourEditDraft] = useState({ taskId: '', hours: '' });
  const [fileQuery, setFileQuery] = useState('');
  const [fileType, setFileType] = useState('Todos');
  const [fileSort, setFileSort] = useState('recent');
  const [selectedDate, setSelectedDate] = useState(() => {
    const value = new URLSearchParams(window.location.search).get('agendaDate') || '';
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return new Date();
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return toLocalDateInput(date) === value ? date : new Date();
  });
  const [agendaView, setAgendaView] = useState(() => {
    const value = new URLSearchParams(window.location.search).get('agendaView');
    return ['Dia', 'Semana', 'Mês'].includes(value) ? value : 'Dia';
  });
  const [agendaQuery, setAgendaQuery] = useState('');
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState([]);
  const [calendarSyncBusy, setCalendarSyncBusy] = useState(false);
  const [calendarSyncError, setCalendarSyncError] = useState('');
  const [calendarSyncedAt, setCalendarSyncedAt] = useState('');
  const [calendarSyncRevision, setCalendarSyncRevision] = useState(0);
  useEffect(() => {
    if (key !== 'agenda') return;
    const params = new URLSearchParams(window.location.search);
    params.set('agendaDate', toLocalDateInput(selectedDate));
    params.set('agendaView', agendaView);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`);
  }, [key, selectedDate, agendaView]);
  useEffect(() => {
    let active = true;
    fetchAllRecords('/api/workspace/clients').then((records) => { if (active) setWorkspaceClients(records); }).catch(() => { if (active) setWorkspaceClients([]); });
    return () => { active = false; };
  }, []);
  const [composer, setComposer] = useState('');
  const [savingAgenda, setSavingAgenda] = useState(false);
  const uploadRef = useRef(null);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  useEffect(() => {
    if (key !== 'tarefas' || !navigationContext?.taskId || !tasksLoaded) return;
    const task = tasks.find((item) => String(item.id) === String(navigationContext.taskId));
    if (task) setSelectedTask(task);
    onNavigationContextConsumed();
  }, [key, navigationContext?.taskId, tasks, tasksLoaded, onNavigationContextConsumed]);
  useEffect(() => {
    if (key !== 'agenda') return undefined;
    let active = true;
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const end = new Date(start);
    if (agendaView === 'Semana') {
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      end.setTime(start.getTime()); end.setDate(start.getDate() + 6);
    } else if (agendaView === 'M\u00eas') {
      start.setDate(1); end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0);
    }
    const from = toLocalDateInput(start);
    const to = toLocalDateInput(end);
    setCalendarSyncBusy(true); setCalendarSyncError('');
    apiRequest(`/api/integrations/google/calendar/events?from=${from}&to=${to}`)
      .then((result) => { if (!active) return; setGoogleCalendarEvents(result.data || []); setCalendarSyncedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })); setCalendarSyncError(result.truncated ? 'A agenda contem mais eventos do que esta consulta exibiu. Reduza o periodo para ver todos.' : ''); })
      .catch((error) => { if (!active) return; setGoogleCalendarEvents([]); setCalendarSyncError(error.message || 'Nao foi possivel ler os eventos do Google Calendar.'); })
      .finally(() => { if (active) setCalendarSyncBusy(false); });
    return () => { active = false; };
  }, [key, selectedDate, agendaView, calendarSyncRevision]);
  const [googleAccountEmail, setGoogleAccountEmail] = useState('');
  const [draft, setDraft] = useState({ title: '', client: '', clientId: '', project: '', projectId: '', due: '', assignee: '', time: '16:30', detail: '', priority: 'Normal', recurrence: 'Nao recorrente', syncGoogleCalendar: true, createMeet: false, attendees: '' });
  const [timerNow, setTimerNow] = useState(Date.now());
  useEffect(() => { let active = true; apiRequest('/api/integrations/status').then((result) => { if (active) setGoogleAccountEmail(result.data?.find((item) => item.provider === 'google')?.accountEmail || ''); }).catch(() => { if (active) setGoogleAccountEmail(''); }); return () => { active = false; }; }, []);
  const activeTimer = hours.find((item) => item.status === 'running');
  const timerRunning = Boolean(activeTimer);
  const hoursTask = tasks.find((item) => String(item.id) === String(hoursTaskId) && !taskIsCompleted(item)) || null;
  const openHourEditor = (entry) => { setHourEditor(entry); setHourEditDraft({ taskId: String(entry.taskId || ''), hours: Number(entry.hours || 0).toFixed(2) }); };
  const saveHourEdit = async (event) => {
    event.preventDefault();
    const task = tasks.find((item) => String(item.id) === String(hourEditDraft.taskId));
    const duration = Number(String(hourEditDraft.hours).replace(',', '.'));
    if (!task || !Number.isFinite(duration) || duration <= 0) { notify('Escolha uma tarefa e informe uma dura??o maior que zero.'); return; }
    const result = await setHours((current) => current.map((item) => item.id === hourEditor.id ? { ...item, taskId: task.id, title: task.title, project: task.project || '', client: task.client || '', hours: Number(duration.toFixed(2)), seconds: Math.round(duration * 3600) } : item));
    if (result?.ok) { setHourEditor(null); notify('Registro de horas atualizado.'); }
    else notify(result?.error?.message || 'N\u00e3o foi poss\u00edvel atualizar o registro.');
  };
  const deleteHourRecord = async (entry) => {
    if (preferences.confirmDelete && !window.confirm('Excluir este registro de horas?')) return;
    const result = await setHours((current) => current.filter((item) => item.id !== entry.id));
    if (result?.ok) notify('Registro de horas exclu\u00eddo.');
    else notify(result?.error?.message || 'N\u00e3o foi poss\u00edvel excluir o registro.');
  };
  const timerSeconds = activeTimer ? Math.max(0, Math.floor((timerNow - new Date(activeTimer.startedAt).getTime()) / 1000)) : 0;
  useEffect(() => {
    if (!activeTimer) return undefined;
    const timer = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeTimer?.id]);
  const toggleTimer = () => {
    const now = new Date();
    if (!activeTimer) {
      const taskForTimer = key === 'horas' ? hoursTask : selectedTask;
      if (key === 'horas' && !taskForTimer) { notify('Selecione uma tarefa ativa antes de iniciar o cronômetro.'); return; }
      const id = globalThis.crypto?.randomUUID?.() || `timer-${Date.now()}`;
      setHours([...hours, { id, title: taskForTimer?.title || 'Tempo sem tarefa', taskId: taskForTimer?.id || null, project: taskForTimer?.project || '', client: taskForTimer?.client || '', startedAt: now.toISOString(), status: 'running' }]);
      notify('Cronômetro iniciado e sincronizado com o workspace.');
      return;
    }
    const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(activeTimer.startedAt).getTime()) / 1000));
    setHours((current) => current.map((item) => item.id === activeTimer.id ? { ...item, endedAt: now.toISOString(), seconds: elapsed, hours: Number((elapsed / 3600).toFixed(2)), status: 'completed' } : item));
    notify('Tempo registrado no workspace.');
  };
  const timerLabel = `${String(Math.floor(timerSeconds / 3600)).padStart(2, '0')}:${String(Math.floor(timerSeconds % 3600 / 60)).padStart(2, '0')}:${String(timerSeconds % 60).padStart(2, '0')}`;
  const notify = (message) => {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(''), 2600);
  };
  const addProject = () => {
    setDraft({ title: '', client: '', clientId: '', project: '', due: '', assignee: '', time: '16:30', detail: '', priority: 'Normal' }); setComposer('projetos');
  };
  const visibleProjects = useMemo(() => projects.filter((item) => (projectStatus === 'Todos' || item.status === projectStatus) && `${item.name} ${item.client} ${item.type}`.toLocaleLowerCase('pt-BR').includes(projectQuery.toLocaleLowerCase('pt-BR'))), [projects, projectStatus, projectQuery]);
  const visibleTasks = useMemo(() => tasks.filter((item) => (taskStatus === 'Todas' ? (preferences.showCompleted || !['concluida', 'concluido', 'completed', 'done'].includes(String(item.status || item.state || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())) : item.status === taskStatus) && [item.title, item.project, item.client].join(' ').toLowerCase().includes(taskQuery.toLowerCase())), [tasks, taskStatus, taskQuery, preferences.showCompleted]);
  const visibleFiles = useMemo(() => {
    const filtered = files.filter((item) => (fileType === 'Todos' || (fileType === 'Pastas' ? item.folder : item.type === fileType)) && `${item.name} ${item.project} ${item.client}`.toLowerCase().includes(fileQuery.toLowerCase()));
    return fileSort === 'recent' ? sortFilesByRecent(filtered) : sortFilesByName(filtered);
  }, [files, fileType, fileQuery, fileSort]);
  const activeProjects = projects.filter((item) => item.status === 'Em andamento').length;
  const waitingProjects = projects.filter((item) => item.status === 'Aguardando cliente').length;
  const doneProjects = projects.filter((item) => item.status === 'Concluído').length;
  const openTasks = tasks.filter((item) => !['Concluída', 'Concluido'].includes(item.status)).length;
  const completedTasks = tasks.length - openTasks;
  const taskCompletion = tasks.length ? Math.round(completedTasks / tasks.length * 100) : 0;

  const toggleTask = async (id) => {
    const result = completeTaskOccurrence(tasks, id);
    if (!result.occurrence) {
      const saved = await setTasks(result.tasks);
      if (!saved.ok) notify(`Não foi possível atualizar a tarefa: ${saved.error?.message || 'erro na API.'}`);
      return;
    }
    const completedOnly = result.tasks.filter((item) => String(item.id) !== String(result.occurrence.id));
    const completionSaved = await setTasks(completedOnly);
    if (!completionSaved.ok) { notify(`Não foi possível concluir a tarefa: ${completionSaved.error?.message || 'erro na API.'}`); return; }
    const occurrenceSaved = await setTasks((current) => current.some((item) => String(item.recurrenceId || item.id) === String(result.occurrence.recurrenceId) && Number(item.recurrenceSequence || 1) === Number(result.occurrence.recurrenceSequence)) ? current : [...current, result.occurrence]);
    if (!occurrenceSaved.ok) { notify(`Tarefa concluída, mas a próxima ocorrência não foi salva. Reabra e conclua esta tarefa para tentar de novo. ${occurrenceSaved.error?.message || ''}`); return; }
    notify(`Tarefa concluída. Próxima ocorrência criada para ${new Date(`${result.occurrence.due}T12:00:00`).toLocaleDateString('pt-BR')}.`);
  };
  const addTask = () => {
    setDraft({ title: '', client: '', clientId: '', project: '', projectId: '', due: '', assignee: '', time: '16:30', detail: '', priority: 'Normal', recurrence: 'Nao recorrente' }); setComposer('tarefas');
  };
  const addApproval = () => {
    setDraft({ title: '', client: '', clientId: '', project: '', projectId: '', fileId: '', due: '', assignee: '', time: '16:30', detail: '', priority: 'Normal' }); setComposer('aprovacoes');
  };
  const addEvent = (date = selectedDate, time = '16:30') => {
    const [hour, minute] = time.split(':').map(Number);
    const endTime = `${String(Math.min(23, hour + (minute >= 30 ? 1 : 0))).padStart(2, '0')}:${minute >= 30 ? '00' : '30'}`;
    setDraft({ title: '', client: '', project: '', due: toLocalDateInput(date), assignee: '', time, endTime, detail: '', priority: 'Normal', syncGoogleCalendar: true, createMeet: false, attendees: '' }); setComposer('agenda');
  };
  const saveAgendaEvent = async () => {
    const tempId = globalThis.crypto?.randomUUID?.() || `event-${Date.now()}`;
    const attendees = String(draft.attendees || '').split(/[;,\s]+/).map((email) => email.trim()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
    const shouldSyncGoogle = draft.syncGoogleCalendar || draft.createMeet;
    const eventRecord = { id: tempId, date: draft.due, time: draft.time, end: draft.endTime, title: draft.title.trim(), detail: draft.detail.trim() || draft.client || 'Agenda da equipe', people: attendees.join(', ') || draft.assignee, googleEventId: '', googleMeetUrl: '', calendarSyncStatus: shouldSyncGoogle ? 'pending' : 'not_requested', color: 'blue' };
    setSavingAgenda(true);
    try {
      const saved = await setEvents((items) => [...items, eventRecord]);
      if (!saved.ok) { notify(`Não foi possível salvar o evento: ${saved.error?.message || 'erro na API.'}`); return; }
      const createdEvent = saved.records?.find((item) => String(item.id) === String(tempId));
      if (!createdEvent) { notify('O Nexo não confirmou o evento salvo. Atualize a agenda antes de tentar novamente.'); return; }
      let googleEvent = null;
      let calendarError = '';
      if (shouldSyncGoogle) {
        try {
          const result = await apiRequest('/api/integrations/google/calendar/events', { method: 'POST', body: JSON.stringify({ eventId: globalThis.crypto?.randomUUID?.().replaceAll('-', ''), title: draft.title.trim(), description: draft.detail.trim() || draft.client || '', date: draft.due, endDate: calendarEndDate(draft.due, draft.time, draft.endTime), startTime: draft.time, endTime: draft.endTime, createMeet: Boolean(draft.createMeet), attendees }) });
          googleEvent = result.data;
        } catch (error) { calendarError = error.message || 'O Google Calendar não confirmou a sincronização.'; }
        const linkedEvent = { ...createdEvent, googleEventId: googleEvent?.eventId || '', googleMeetUrl: googleEvent?.meetUrl || '', calendarSyncStatus: googleEvent ? 'connected' : 'not_connected', calendarSyncError: calendarError };
        const linked = await setEvents((items) => items.map((item) => String(item.id) === String(createdEvent.id) ? linkedEvent : item));
        if (!linked.ok && googleEvent?.eventId) {
          try { await apiRequest(`/api/integrations/google/calendar/events/${googleEvent.eventId}`, { method: 'DELETE' }); } catch { calendarError = `${calendarError} O evento criado no Google não pôde ser removido automaticamente.`.trim(); }
        }
      }
      setComposer('');
      notify(googleEvent ? (googleEvent.meetUrl ? 'Evento salvo e sincronizado; link do Meet criado.' : 'Evento salvo e sincronizado com Google Calendar.') : shouldSyncGoogle ? `Evento salvo no Nexo, mas não sincronizado com o Google: ${calendarError || 'confira sua conexão Google Workspace.'}` : 'Evento salvo na agenda do Nexo.');
    } finally { setSavingAgenda(false); }
  };
  const saveComposer = async (event) => {
    event.preventDefault(); if (!draft.title.trim()) return;
    if (composer === 'agenda' && savingAgenda) return;
    if (composer === 'agenda' && (!draft.due || !draft.time || !draft.endTime || draft.endTime <= draft.time)) { notify('Informe a data e um término posterior ao início.'); return; }
    if (composer === 'agenda') { await saveAgendaEvent(); return; }
    const id = Date.now();
    if (composer === 'projetos') {
      const client = workspaceClients.find((item) => String(item.id) === String(draft.clientId));
      setProjects((items) => [{ id, name: draft.title.trim(), client: String(client?.name || client?.title || 'Sem cliente'), clientId: client?.id || '', type: 'Projeto', status: 'Em andamento', progress: 0, due: draft.due || 'A definir', team: [draft.assignee].filter(Boolean), tone: 'lime' }, ...items]); notify('Projeto criado e salvo.');
    }
    else if (composer === 'tarefas') {
      const project = projects.find((item) => String(item.id) === String(draft.projectId));
      const client = workspaceClients.find((item) => String(item.id) === String(draft.clientId)) || findProjectClient(project, workspaceClients);
      setTasks((items) => [{ id, title: draft.title.trim(), project: project?.name || draft.project || 'Sem projeto', projectId: project?.id || '', client: String(client?.name || client?.title || project?.client || 'Sem cliente'), clientId: client?.id || project?.clientId || '', due: draft.due || 'A definir', assignee: draft.assignee, status: 'A fazer', priority: draft.priority, recurrence: draft.recurrence || 'Nao recorrente', recurrenceSequence: 1 }, ...items]); notify('Tarefa criada e salva.');
    }
    else if (composer === 'aprovacoes') {
      const client = workspaceClients.find((item) => String(item.id) === String(draft.clientId));
      const file = files.find((item) => String(item.id) === String(draft.fileId));
      if (!client || !file?.driveFileId) { notify('Selecione um cliente e um arquivo enviado ao Google Drive.'); return; }
      if (!window.confirm(`O Google Drive vai permitir que qualquer pessoa com o link veja “${file.name}”. Continuar para anexar este material à aprovação?`)) return;
      try {
        const shared = await apiRequest(`/api/integrations/google/drive/${encodeURIComponent(file.driveFileId)}/share-for-portal`, { method: 'POST', body: JSON.stringify({ confirmPublicAccess: true }) });
        const record = { id, title: draft.title.trim(), project: draft.project.trim() || 'Sem projeto', projectId: draft.projectId || '', client: String(client.name || client.title || 'Cliente'), clientId: client.id, kind: file.type === 'image' ? 'Imagem' : file.type === 'pdf' ? 'PDF' : 'Arquivo', sent: new Date().toISOString(), reviewer: String(client.contactName || client.name || 'Cliente'), initials: String(client.name || client.title || 'C').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), status: 'Aguardando', attachment: { name: file.name, url: shared.data.url, mimeType: file.mimeType || '', driveFileId: file.driveFileId, permissionId: shared.data.permissionId || null, publicAccess: true } };
        const saved = await setApprovals((items) => [record, ...items]);
        if (!saved.ok && shared.data.created && shared.data.permissionId) await apiRequest(`/api/integrations/google/drive/${encodeURIComponent(file.driveFileId)}/share-for-portal`, { method: 'DELETE', body: JSON.stringify({ permissionId: shared.data.permissionId }) }).catch(() => {});
        if (!saved.ok) { notify(`O arquivo foi compartilhado, mas a aprovação não foi salva: ${saved.error?.message || 'erro na API.'}`); return; }
        notify('Aprovação vinculada ao cliente e ao arquivo; o material pode ser revogado no Google Drive.');
      } catch (error) { notify(error.message || 'Não foi possível compartilhar o arquivo para o portal.'); return; }
    }
    else { setFiles((items) => [{ id, name: draft.title.trim(), project: draft.project || 'Sem projeto', client: draft.client || 'Sem cliente', date: 'Agora', size: '—', type: 'pdf', folder: false }, ...items]); notify('Arquivo registrado na lista local.'); }
    setComposer('');
  };
  const addLocalFile = async (file) => {
    if (!file) return;
    if (!file.size || file.size > 8 * 1024 * 1024) { notify('O arquivo precisa ter ate 8 MiB.'); return; }
    setUploadingFiles(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Nao foi possivel ler o arquivo.')); reader.onload = () => resolve(String(reader.result || '')); reader.readAsDataURL(file); });
      const uploaded = await apiRequest('/api/integrations/google/drive/upload', { method: 'POST', body: JSON.stringify({ name: file.name, mimeType: file.type || 'application/octet-stream', data: dataUrl.slice(dataUrl.indexOf(',') + 1) }) });
      const result = uploaded.data;
      setFiles((items) => [{ id: result.id, name: result.name, project: '', client: '', date: new Date(result.createdAt).toLocaleDateString('pt-BR'), size: `${(result.size / 1024 / 1024).toFixed(2)} MB`, type: file.type.startsWith('image/') ? 'image' : file.type.includes('pdf') ? 'pdf' : 'file', folder: false, url: result.url, driveFileId: result.id, mimeType: result.mimeType }, ...items]);
      notify(`Arquivo enviado ao Google Drive: ${result.name}`);
    } catch (error) { notify(error.message || 'O envio ao Google Drive falhou. Verifique a conexao em Integracoes.'); }
    finally { setUploadingFiles(false); if (uploadRef.current) uploadRef.current.value = ''; }
  };
  const decideApproval = async (id, status) => {
    const approval = approvals.find((item) => item.id === id);
    const canonicalStatus = status === 'Aprovado' || status === 'Aprovada' ? 'Aprovada' : 'Alterações solicitadas';
    const saved = await setApprovals((current) => current.map((item) => String(item.id) === String(id) ? { ...item, status: canonicalStatus, decidedAt: new Date().toISOString() } : item));
    if (!saved.ok) { notify(`Não foi possível salvar a decisão: ${saved.error?.message || 'erro na API.'}`); return; }
    notify(canonicalStatus === 'Aprovada' ? 'Material aprovado.' : 'Pedido de ajuste registrado.');
  };
  const revokeApprovalShare = async (approval) => {
    const attachment = approval?.attachment;
    if (!attachment?.driveFileId) return;
    if (!attachment.permissionId) { notify('O acesso publico ja existia. Revogue-o na tela de compartilhamento do Google Drive.'); return; }
    if (!window.confirm(`Revogar o acesso publico ao arquivo "${attachment.name || approval.title}"? Outros links que usem este arquivo tambem deixarao de funcionar.`)) return;
    try {
      await apiRequest(`/api/integrations/google/drive/${encodeURIComponent(attachment.driveFileId)}/share-for-portal`, { method: 'DELETE', body: JSON.stringify({ permissionId: attachment.permissionId }) });
      const saved = await setApprovals((items) => items.map((item) => String(item.id) === String(approval.id) ? { ...item, attachment: { ...item.attachment, publicAccess: false, permissionId: null, url: '' } } : item));
      if (!saved.ok) { notify('Acesso revogado no Google Drive, mas a ficha nao sincronizou. Atualize a pagina.'); return; }
      notify('Acesso publico revogado. O cliente nao consegue mais abrir este material.');
    } catch (error) { notify(error.message || 'Nao foi possivel revogar o acesso no Google Drive.'); }
  };
  const updateProject = async (project, patch) => {
    const updated = { ...project, ...patch };
    const result = await setProjects((current) => current.map((item) => item.id === project.id ? updated : item));
    if (result?.ok) { setSelectedProject(updated); return true; }
    notify(result?.error?.message || 'N\u00e3o foi poss\u00edvel salvar os detalhes do projeto.');
    return false;
  };
  const moveProject = (id, status) => setProjects((current) => current.map((item) => item.id === id ? { ...item, status } : item));

  const saveEventChanges = async (patch) => {
    const updated = { ...selectedEvent, ...patch };
    if (!updated.date || (!updated.allDay && (!updated.time || !updated.end || updated.end <= updated.time))) { notify('Informe uma data e um termino posterior ao inicio.'); return; }
    const googleOnly = selectedEvent.calendarSource === 'google';
    if (!googleOnly) {
      const localSave = await setEvents((current) => current.map((item) => String(item.id) === String(selectedEvent.id) ? updated : item));
      if (!localSave.ok) { notify(`Nao foi possivel salvar o evento: ${localSave.error?.message || 'erro na API.'}`); return; }
    }
    if (!selectedEvent.googleEventId) { notify('Evento atualizado na agenda do Nexo.'); setSelectedEvent(null); return; }
    try {
      const attendees = String(updated.people || '').split(/[;,\s]+/).map((email) => email.trim()).filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
      const endDate = updated.allDay ? (selectedEvent.allDay && updated.date === selectedEvent.date ? selectedEvent.endDate : nextCalendarDate(updated.date)) : calendarEndDate(updated.date, updated.time, updated.end);
      const result = await apiRequest('/api/integrations/google/calendar/events', { method: 'PATCH', body: JSON.stringify({ eventId: selectedEvent.googleEventId, title: updated.title, description: updated.detail, date: updated.date, endDate, allDay: Boolean(updated.allDay), startTime: updated.time || '00:00', endTime: updated.end || '23:59', attendees, createMeet: Boolean(selectedEvent.googleMeetUrl) }) });
      const synced = { ...updated, googleMeetUrl: result.data?.meetUrl || updated.googleMeetUrl, calendarSyncStatus: 'connected', calendarSyncError: '' };
      if (googleOnly) setGoogleCalendarEvents((current) => current.map((item) => String(item.googleEventId) === String(selectedEvent.googleEventId) ? synced : item));
      else {
        const syncSave = await setEvents((current) => current.map((item) => String(item.id) === String(selectedEvent.id) ? synced : item));
        if (!syncSave.ok) { notify('Google Calendar foi atualizado, mas o estado da sincronizacao nao foi salvo no workspace.'); return; }
      }
      notify(googleOnly ? 'Evento atualizado no Google Calendar.' : 'Evento atualizado no Nexo e no Google Calendar.');
    } catch (error) {
      if (googleOnly) { notify(error.message || 'O Google Calendar nao confirmou a alteracao.'); return; }
      const failed = { ...updated, calendarSyncStatus: 'not_connected', calendarSyncError: error.message || 'Falha ao atualizar o Google Calendar.' };
      const syncSave = await setEvents((current) => current.map((item) => String(item.id) === String(selectedEvent.id) ? failed : item));
      notify(syncSave.ok ? `Evento salvo no Nexo, mas o Google Calendar nao confirmou: ${failed.calendarSyncError}` : 'Evento atualizado no Nexo, porem houve falha ao registrar a sincronizacao.');
    }
    setSelectedEvent(null);
  };
  const deleteSelectedEvent = async () => {
    if (preferences.confirmDelete && !window.confirm('Excluir este evento da agenda?')) return;
    const googleOnly = selectedEvent.calendarSource === 'google';
    if (selectedEvent.googleEventId) {
      try { await apiRequest(`/api/integrations/google/calendar/events/${selectedEvent.googleEventId}`, { method: 'DELETE' }); }
      catch (error) { notify(error.message || 'O Google Calendar nao confirmou a exclusao.'); return; }
    }
    if (googleOnly) setGoogleCalendarEvents((current) => current.filter((item) => String(item.googleEventId) !== String(selectedEvent.googleEventId)));
    else {
      const deleted = await setEvents((current) => current.filter((item) => String(item.id) !== String(selectedEvent.id)));
      if (!deleted.ok) { notify(`Nao foi possivel remover o evento do Nexo: ${deleted.error?.message || 'erro na API.'}`); return; }
    }
    setSelectedEvent(null);
    notify(googleOnly ? 'Evento removido do Google Calendar.' : 'Evento removido da agenda.');
  };

  return <main className="work-screen">
    {(projectsError || tasksError) && <div className="dashboard-data-error" role="alert">{projectsError || tasksError}</div>}
    <header className="work-heading">
      <div className="work-title-wrap"><span className="work-title-icon"><screen.icon size={19} /></span><div><h1>{screen.title}</h1><p>{screen.description}</p></div></div>
      <div className="work-heading-actions"><button className="work-button work-button-quiet" onClick={() => key === 'projetos' ? setProjectStatus('Todos') : key === 'tarefas' ? document.querySelector('.inline-search input')?.focus() : key === 'arquivos' ? document.querySelector('.drive-search input')?.focus() : key === 'agenda' ? document.querySelector('.agenda-search input')?.focus() : notify('Busca disponível nesta tela.')}><Search size={16} /><span>Buscar</span></button>{key !== 'horas' && !(isMember && key === 'projetos') && <button className="work-button work-button-primary" onClick={key === 'agenda' ? addEvent : key === 'projetos' ? addProject : key === 'tarefas' ? addTask : key === 'arquivos' ? () => uploadRef.current?.click() : addApproval}><Plus size={16} />{key === 'agenda' ? 'Novo evento' : key === 'projetos' ? 'Novo projeto' : key === 'tarefas' ? 'Nova tarefa' : key === 'arquivos' ? 'Enviar arquivo' : 'Nova solicitação'}</button>}</div>
    </header>

    {key === 'projetos' && <>
      <section className="work-metrics"><Metric label="Em andamento" value={activeProjects} note={`${projects.length} projetos cadastrados`} icon={Activity} tone="lime" /><Metric label="Aguardando cliente" value={waitingProjects} note={`${approvals.filter((item) => item.status !== 'Aprovada' && item.status !== 'Aprovado').length} aprovações pendentes`} icon={Clock3} tone="blue" /><Metric label="Concluídos" value={doneProjects} note="projetos finalizados" icon={CheckCircle2} tone="green" /></section>
      <div className="work-toolbar project-toolbar"><label className="inline-search project-search"><Search size={15} /><input value={projectQuery} onChange={(event) => setProjectQuery(event.target.value)} placeholder="Buscar projeto, cliente ou serviço" /></label><div className="work-tabs">{['Todos', 'Em andamento', 'Aguardando cliente', 'Concluído'].map((status) => <button key={status} className={projectStatus === status ? 'active' : ''} onClick={() => setProjectStatus(status)}>{status}<span>{status === 'Todos' ? projects.length : projects.filter((p) => p.status === status).length}</span></button>)}</div><div className="work-view-toggle project-view-toggle">{[['grid', LayoutGrid, 'Cartões'], ['list', List, 'Lista'], ['kanban', FolderKanbanIcon, 'Kanban'], ['calendar', CalendarDays, 'Calendário'], ['timeline', Clock3, 'Timeline']].map(([id, Icon, label]) => <button key={id} title={label} aria-label={`Visualização ${label}`} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon size={16} /></button>)}</div></div>
      {view === 'kanban' ? <div className="project-kanban">{['A fazer', 'Em andamento', 'Aguardando cliente', 'Concluído'].map((status) => <section className="project-kanban-column" key={status} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedProject) moveProject(draggedProject, status); setDraggedProject(null); }}><header><b>{status}</b><span>{visibleProjects.filter((item) => item.status === status).length}</span></header>{visibleProjects.filter((item) => item.status === status).map((project) => <div key={project.id} draggable onDragStart={() => setDraggedProject(project.id)} onDragEnd={() => setDraggedProject(null)}><ProjectCard project={project} onOpen={() => setSelectedProject(project)} /></div>)}{!visibleProjects.some((item) => item.status === status) && <p className="project-kanban-empty">Solte projetos nesta etapa</p>}</section>)}</div> : view === 'timeline' ? <div className="project-timeline">{visibleProjects.map((project, index) => <article key={project.id} className="project-timeline-row"><div className="project-timeline-label"><span className={`project-timeline-dot ${project.tone}`} /><button onClick={() => setSelectedProject(project)}><b>{project.name}</b><small>{project.client} · {project.due}</small></button></div><div className="project-timeline-track"><i style={{ left: `${Math.min(65, index * 12)}%`, width: `${Math.max(18, project.progress || 10)}%` }} /><span>{project.progress}%</span></div><StatusPill status={project.status} /></article>)}</div> : view === 'calendar' ? <div className="project-calendar"><header><CalendarDays size={16}/><b>Entregas e prazos</b><small>Datas informadas nos projetos</small></header>{visibleProjects.map((project) => <button className="project-calendar-row" key={project.id} onClick={() => setSelectedProject(project)}><span>{project.due || 'Sem prazo'}</span><b>{project.name}</b><small>{project.client}</small><StatusPill status={project.status}/></button>)}{!visibleProjects.length&&<Empty title="Nenhum projeto neste filtro" text="Crie um projeto ou altere a busca."/>}</div> : <div className={`project-grid ${view === 'list' ? 'project-list' : ''}`}>{visibleProjects.map((project) => <ProjectCard key={project.id} project={project} onOpen={() => setSelectedProject(project)} />)}{visibleProjects.length === 0 && <Empty title="Nenhum projeto neste filtro" text="Escolha outro status para ver seus projetos." />}</div>}
    </>}

    {key === 'tarefas' && <>
      <section className="task-summary"><div><span className="summary-number">{openTasks}</span><span>tarefas abertas</span></div><div className="summary-track"><span style={{ width: `${taskCompletion}%` }} /></div><span className="summary-caption">{completedTasks} de {tasks.length} concluídas</span><div className="summary-people">{[...new Set(tasks.map((task) => task.assignee).filter(Boolean))].slice(0, 4).map((person) => <Avatar key={person} name={person} />)}</div></section>
      <section className="work-panel"><div className="panel-toolbar"><div className="work-tabs">{['Todas', 'A fazer', 'Em andamento', 'Concluída'].map((status) => <button key={status} className={taskStatus === status ? 'active' : ''} onClick={() => setTaskStatus(status)}>{status}</button>)}</div><label className="inline-search"><Search size={15} /><input value={taskQuery} onChange={(e) => setTaskQuery(e.target.value)} placeholder="Buscar tarefa" /></label></div><div className="task-table"><div className="task-table-head"><span>Tarefa</span><span>Projeto</span><span>Responsável</span><span>Prazo</span><span>Status</span><span /></div>{visibleTasks.map((task) => <div className={`task-row ${task.status === 'Concluída' ? 'task-row-done' : ''}`} key={task.id}><button className="task-check" aria-label={task.status === 'Concluída' ? 'Reabrir tarefa' : 'Concluir tarefa'} onClick={() => toggleTask(task.id)}>{task.status === 'Concluída' ? <CheckCircle2 size={19} /> : <Circle size={19} />}</button><div className="task-main"><strong>{task.title}</strong><small>{task.client} <span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span></small></div><span className="task-project">{task.project}</span><span className="task-owner"><Avatar name={task.assignee} /> {task.assignee}</span><span className="task-due"><Clock3 size={14} />{task.due}</span><StatusPill status={task.status} /><button className="row-more" aria-label="Mais opções" onClick={() => setSelectedTask(task)}><MoreHorizontal size={18} /></button></div>)}{visibleTasks.length === 0 && <Empty title="Nada por aqui" text="Tente outro filtro ou termo de busca." />}</div></section>
    </>}

    {key === 'agenda' && <>{eventsError && <div className="dashboard-data-error" role="alert">{eventsError}</div>}<AgendaCalendar events={[...events, ...googleCalendarEvents.filter((item) => !events.some((event) => event.googleEventId === item.googleEventId))]} selectedDate={selectedDate} setSelectedDate={setSelectedDate} agendaView={agendaView} setAgendaView={setAgendaView} agendaQuery={agendaQuery} setAgendaQuery={setAgendaQuery} calendarSyncBusy={calendarSyncBusy} calendarSyncError={calendarSyncError} calendarSyncedAt={calendarSyncedAt} onSyncGoogleCalendar={() => setCalendarSyncRevision((revision) => revision + 1)} onSelectEvent={setSelectedEvent} onCreateEvent={addEvent} /></>}
    {key === 'horas' && <>
      <section className="hours-overview"><div className="hours-total"><div><span className="eyebrow">CRONÔMETRO {timerRunning ? '· EM ANDAMENTO' : ''}</span><strong className="running-timer">{timerLabel}</strong><small>{timerRunning ? `Registrando tempo para ${activeTimer.title}` : 'Tempo desta sessão sincronizado com o workspace'}</small></div><div className="hours-ring"><div><strong>{Math.min(100, Math.round(timerSeconds / 1440))}%</strong><small>meta diária</small></div></div></div><div className="hours-stat"><span className="hours-stat-icon blue"><Timer size={17} /></span><div><small>Faturáveis nesta sessão</small><strong>{Math.floor(timerSeconds / 3600)}h {Math.floor(timerSeconds % 3600 / 60)}m</strong><em>Registro no workspace</em></div></div><div className="hours-stat"><span className="hours-stat-icon lime"><Activity size={17} /></span><div><small>Projetos ativos</small><strong>{projects.filter((project) => project.status !== 'Concluído').length} projetos</strong><em>em acompanhamento</em></div></div><label className="period-select"><span>Período</span><select value={hoursPeriod} onChange={(e) => setHoursPeriod(e.target.value)}><option>Esta semana</option><option>Semana passada</option><option>Este mês</option></select><ChevronDown size={14} /></label></section>
      <section className="work-panel hours-panel"><div className="panel-section-heading"><div><h2>Horas por projeto</h2><p>Registros concluídos · {hoursPeriod.toLowerCase()}</p></div><button className="work-button work-button-quiet" onClick={() => { const completed = hours.filter((item) => item.status === 'completed'); const csv = rowsToCsv([['Projeto', 'Cliente', 'Tarefa', 'Horas', 'Inicio', 'Fim'], ...completed.map((item) => [item.project || '', item.client || '', item.title || '', item.hours || 0, item.startedAt || '', item.endedAt || ''])]); downloadCsvFile('horas-workspace.csv', csv); notify('Relatorio exportado com os registros do workspace.'); }}><Download size={15} /> Exportar</button></div><div className="hours-table"><div className="hours-table-head"><span>Projeto</span><span>Responsável</span><span>Horas</span><span>Progresso</span><span>Último registro</span></div>{hours.filter((item) => item.status === 'completed').map((row) => <div className="hours-row" key={row.id}><div className="hours-project"><span className="file-icon file-folder"><Folder size={16} /></span><span><b>{row.project || 'Sem projeto'}</b><small>{row.client || 'Sem cliente'} · {row.title}</small></span></div><span className="task-owner">Workspace</span><strong>{Number(row.hours || 0).toFixed(2)}h</strong><div className="hours-bar"><i style={{ width: '100%' }} /><small>Registrado</small></div><span className="hours-last">{row.endedAt ? new Date(row.endedAt).toLocaleString('pt-BR') : '—'}</span><div className="hours-row-actions"><button type="button" aria-label={`Editar registro de ${row.title}`} title="Editar registro" onClick={() => openHourEditor(row)}><MoreHorizontal size={16} /></button><button type="button" aria-label={`Excluir registro de ${row.title}`} title="Excluir registro" onClick={() => deleteHourRecord(row)}><X size={15} /></button></div></div>)}{!hours.some((item) => item.status === 'completed') && <div className="work-empty-state">Nenhum tempo registrado ainda.</div>}</div><label className="hours-task-picker" htmlFor="hours-task-select"><span>Vincular a uma tarefa</span><select id="hours-task-select" value={hoursTaskId} onChange={(event) => setHoursTaskId(event.target.value)} disabled={timerRunning || !tasks.some((item) => !taskIsCompleted(item))}><option value="">{tasks.some((item) => !taskIsCompleted(item)) ? 'Selecione uma tarefa ativa' : 'Cadastre uma tarefa para iniciar'}</option>{tasks.filter((item) => !taskIsCompleted(item)).map((item) => <option key={item.id} value={item.id}>{item.title}{item.project ? ` · ${item.project}` : ''}</option>)}</select><small>{timerRunning ? `Cronômetro vinculado a ${activeTimer.title}.` : 'O tempo será associado à tarefa selecionada.'}</small></label><button className={`start-timer ${timerRunning ? 'timer-active' : ''}`} onClick={toggleTimer}><span><Timer size={17} /></span><b>{timerRunning ? `Parar cronômetro · ${timerLabel}` : 'Iniciar cronômetro'}</b><small>{timerRunning ? activeTimer.title : hoursTask?.title || 'Selecione uma tarefa para vincular o tempo'}</small><ArrowRight size={16} /></button></section>
      {hourEditor && <div className="work-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHourEditor(null); }}><form className="work-compose-modal hours-edit-modal" aria-labelledby="hours-edit-title" onSubmit={saveHourEdit}><header><div><span className="eyebrow">HORAS &middot; AJUSTE</span><h2 id="hours-edit-title">Editar registro</h2></div><button type="button" aria-label="Fechar" onClick={() => setHourEditor(null)}><X size={18} /></button></header><label>Tarefa<select required value={hourEditDraft.taskId} onChange={(event) => setHourEditDraft((current) => ({ ...current, taskId: event.target.value }))}><option value="">Selecione uma tarefa</option>{tasks.map((item) => <option key={item.id} value={item.id}>{item.title}{item.project ? ` - ${item.project}` : ''}</option>)}</select></label><label>Dura&#231;&#227;o registrada (horas)<input required type="number" min="0.01" step="0.01" inputMode="decimal" value={hourEditDraft.hours} onChange={(event) => setHourEditDraft((current) => ({ ...current, hours: event.target.value }))} /></label><p>O cliente e o projeto acompanham a tarefa selecionada.</p><footer><button type="button" className="work-button work-button-quiet" onClick={() => setHourEditor(null)}>Cancelar</button><button type="submit" className="work-button work-button-primary"><Check size={14} />Salvar ajustes</button></footer></form></div>}
    </>}

    {key === 'aprovacoes' && <>
      <section className="approval-summary"><div className="approval-count"><span className="approval-count-icon"><Clock3 size={18} /></span><div><strong>{approvals.filter((item) => item.status !== 'Aprovada' && item.status !== 'Aprovado').length}</strong><span>aguardando retorno</span></div></div><p>Aprovações ficam vinculadas ao cliente e exibem o arquivo compartilhado no portal.</p><button onClick={() => { window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Portal do cliente' })); notify('Selecione o cliente nesta tela e gere o link de acesso ao portal.'); }}><Send size={15} /> Abrir portal do cliente</button></section>
      <div className="approval-list">{approvals.map((item) => <article className="approval-card" key={item.id}><div className={`approval-preview preview-${item.kind.toLowerCase()}`}><FileText size={24} /><span>{item.kind}</span><button aria-label="Visualizar material" onClick={() => setSelectedApproval(item)}><ArrowUpRight size={16} /></button></div><div className="approval-info"><div className="approval-title-line"><div><span className="approval-project">{item.project} <ChevronRight size={12} /> {item.client}</span><h3>{item.title}</h3></div><StatusPill status={item.status} /></div><div className="approval-meta"><span>Enviado {item.sent}</span><span className="reviewer"><Avatar name={item.initials} /> Aguardando {item.reviewer}</span></div><div className="approval-actions">{item.status === 'Aguardando' ? <><button className="work-button work-button-quiet" onClick={() => setSelectedApproval(item)}>Adicionar comentário</button><button className="work-button work-button-quiet" onClick={() => decideApproval(item.id, 'Ajustes solicitados')}>Solicitar ajuste</button><button className="work-button work-button-approve" onClick={() => decideApproval(item.id, 'Aprovado')}><Check size={15} /> Aprovar</button></> : <button className="work-button work-button-quiet" onClick={() => setSelectedApproval(item)}>Ver histórico <ArrowRight size={14} /></button>}</div></div></article>)}</div>
    </>}

    {key === 'arquivos' && <>
      <section className="drive-breadcrumb"><button onClick={() => setFileType('Todos')}>Arquivos</button><ChevronRight size={15} /><span>Todos os arquivos</span><span className="drive-space">{googleAccountEmail ? `Google Drive conectado: ${googleAccountEmail}` : 'Conecte o Google Drive em Integracoes para enviar arquivos'}</span></section>
      <section className="drive-tools"><label className="drive-search"><Search size={16} /><input placeholder="Buscar arquivos e pastas" value={fileQuery} onChange={(e) => setFileQuery(e.target.value)} /><kbd>⌘ K</kbd></label><div className="drive-filters"><SlidersHorizontal size={15} />{['Todos', 'Pastas', 'pdf', 'image', 'sheet'].map((type) => <button key={type} className={fileType === type ? 'active' : ''} onClick={() => setFileType(type)}>{type === 'image' ? 'Imagens' : type === 'sheet' ? 'Planilhas' : type === 'pdf' ? 'PDFs' : type}</button>)}</div><button type="button" className="work-button work-button-quiet" aria-pressed={fileSort === 'recent'} onClick={() => setFileSort((current) => current === 'recent' ? 'name' : 'recent')}><ArrowDown size={14} /> {fileSort === 'recent' ? 'Recentes' : 'Nome A-Z'}</button></section>
      <div className="drive-section-heading"><h2>Acessados recentemente</h2><button onClick={() => setView(view === 'grid' ? 'list' : 'grid')}>{view === 'grid' ? <List size={16} /> : <LayoutGrid size={16} />} {view === 'grid' ? 'Lista' : 'Grade'}</button></div>
      <section className={`drive-grid ${view === 'list' ? 'drive-list' : ''}`}>{visibleFiles.map((file) => <FileCard key={file.id} file={file} onOpen={() => file.url ? window.open(file.url, '_blank', 'noopener,noreferrer') : setSelectedFile(file)} onMenu={() => setSelectedFile(file)} />)}{visibleFiles.length === 0 && <Empty title="Nenhum arquivo encontrado" text="Mude os filtros ou tente outra busca." />}</section>
      <div className="drive-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); Array.from(e.dataTransfer.files).forEach(addLocalFile); }}><span><Upload size={18} /></span><div><b>Organize os arquivos do seu time</b><small>Arraste arquivos para cá ou selecione um arquivo do computador</small></div><button disabled={uploadingFiles} onClick={() => uploadRef.current?.click()}>{uploadingFiles ? 'Enviando...' : 'Selecionar arquivo'}</button><input ref={uploadRef} type="file" hidden multiple onChange={(e) => { Array.from(e.target.files || []).forEach(addLocalFile); e.target.value = ''; }} /></div>
    </>}

    {selectedTask && key === 'tarefas' && <TaskDetail task={selectedTask} tasks={tasks} onClose={() => setSelectedTask(null)} onSave={(patch) => { setTasks((current) => current.map((item) => item.id === selectedTask.id ? { ...item, ...patch } : item)); setSelectedTask((current) => ({ ...current, ...patch })); }} onFileUploaded={(file) => setFiles((current) => [{ id: globalThis.crypto?.randomUUID?.() || `drive-file-${Date.now()}`, name: file.name, project: selectedTask.project || '', client: selectedTask.client || '', taskId: selectedTask.id, size: `${(file.size / 1024 / 1024).toFixed(2)} MB`, type: file.mimeType.startsWith('image/') ? 'image' : file.mimeType === 'application/pdf' ? 'pdf' : 'file', folder: false, url: file.url, driveFileId: file.id, mimeType: file.mimeType }, ...current])} onAction={notify} />}
    {selectedEvent && key === 'agenda' && <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} onSave={saveEventChanges} onDelete={deleteSelectedEvent} />}
    {selectedFile && key === 'arquivos' && <FileDetail file={selectedFile} onClose={() => setSelectedFile(null)} onSave={(patch) => { const updated = { ...patch, updatedAt: new Date().toISOString() }; setFiles((current) => current.map((item) => item.id === selectedFile.id ? { ...item, ...updated } : item)); setSelectedFile((current) => ({ ...current, ...updated })); notify('Metadados do arquivo atualizados.'); }} onDelete={() => { if (preferences.confirmDelete && !window.confirm(`Remover o registro local de ${selectedFile.name}?`)) return; setFiles((current) => current.filter((item) => item.id !== selectedFile.id)); setSelectedFile(null); notify('Registro de arquivo removido. O arquivo original nao foi alterado.'); }} />}
    {selectedApproval && key === 'aprovacoes' && <ApprovalDetail approval={approvals.find((item) => item.id === selectedApproval.id) || selectedApproval} onClose={() => setSelectedApproval(null)} onRevokeShare={revokeApprovalShare} onComment={(text) => { setApprovals((current) => current.map((item) => item.id === selectedApproval.id ? { ...item, comments: [{ id: Date.now(), text, at: new Date().toISOString() }, ...(item.comments || [])] } : item)); notify('Comentario registrado no historico local.'); }} onDecision={(status) => { decideApproval(selectedApproval.id, status); setSelectedApproval(null); }} />}
    {selectedProject && key === 'projetos' && <ProjectDetail project={selectedProject} clients={workspaceClients} tasks={tasks.filter((task) => task.project === selectedProject.name)} onClose={() => setSelectedProject(null)} onUpdate={(patch) => updateProject(selectedProject, patch)} onTaskToggle={toggleTask} onAddTask={(task) => setTasks((current) => [task, ...current])} onAction={notify} />}
    {composer && <div className="work-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setComposer(''); }}><form className="work-compose-modal" aria-busy={composer === 'agenda' && savingAgenda} onSubmit={saveComposer}><header><div><span className="eyebrow">NEXO · {composer === 'aprovacoes' ? 'APROVAÇÕES' : composer.toUpperCase()}</span><h2>{composer === 'projetos' ? 'Criar projeto' : composer === 'tarefas' ? 'Criar tarefa' : composer === 'agenda' ? 'Novo evento' : composer === 'aprovacoes' ? 'Solicitar aprovação' : 'Registrar arquivo'}</h2></div><button type="button" aria-label="Fechar" onClick={() => setComposer('')}><X size={18} /></button></header><label>{composer === 'arquivos' ? 'Nome do arquivo' : 'Título'}<input autoFocus required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={composer === 'projetos' ? 'Ex.: Site institucional' : composer === 'tarefas' ? 'Ex.: Revisar homepage' : composer === 'agenda' ? 'Ex.: Reunião de briefing' : composer === 'aprovacoes' ? 'Ex.: Homepage · versão 01' : 'Ex.: Briefing aprovado'} /></label>{composer === 'aprovacoes' ? <><label>Cliente<select required value={draft.clientId || ''} onChange={(e) => { const client = workspaceClients.find((item) => String(item.id) === e.target.value); setDraft({ ...draft, clientId: e.target.value, client: String(client?.name || client?.title || ''), projectId: '', project: '' }); }}><option value="">Selecione um cliente</option>{workspaceClients.map((item) => <option key={item.id} value={item.id}>{item.name || item.title || 'Cliente'}</option>)}</select></label><label>Projeto relacionado<select value={draft.projectId || ''} onChange={(e) => { const project = projects.find((item) => String(item.id) === e.target.value); setDraft({ ...draft, projectId: e.target.value, project: project?.name || '' }); }}><option value="">Sem projeto</option>{projects.filter((item) => !item.clientId || String(item.clientId) === String(draft.clientId)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Arquivo compartilhado<select required value={draft.fileId || ''} onChange={(e) => setDraft({ ...draft, fileId: e.target.value })}><option value="">Selecione um arquivo do Google Drive</option>{files.filter((item) => item.driveFileId && item.url).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{files.filter((item) => item.driveFileId && item.url).length === 0 && <div className="approval-drive-setup"><p className="work-modal-note">Conecte o Google Drive em Integra&#231;&#245;es e envie um arquivo pela aba Arquivos para compartilh&#225;-lo com seguran&#231;a no portal.</p><button type="button" className="work-button work-button-quiet" onClick={() => { setComposer(''); window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Integra\u00e7\u00f5es' })); }}>Configurar Google Drive</button></div>}</> : <>{['projetos', 'tarefas'].includes(composer) && <label>Cliente<select value={draft.clientId || ''} onChange={(e) => { const client = workspaceClients.find((item) => String(item.id) === e.target.value); setDraft({ ...draft, clientId: e.target.value, client: String(client?.name || client?.title || ''), projectId: '', project: '' }); }}><option value="">Sem cliente vinculado</option>{workspaceClients.map((item) => <option key={item.id} value={item.id}>{item.name || item.title || 'Cliente'}</option>)}</select></label>}{composer === 'arquivos' && <label>Cliente<input value={draft.client} onChange={(e) => setDraft({ ...draft, client: e.target.value })} placeholder="Nome do cliente" /></label>}</>}{composer === 'tarefas' && <label>Projeto relacionado<select value={draft.projectId || ''} onChange={(e) => { const project = projects.find((item) => String(item.id) === e.target.value); const linkedClient = findProjectClient(project, workspaceClients); setDraft({ ...draft, projectId: e.target.value, project: project?.name || '', ...(!draft.clientId && linkedClient ? { clientId: linkedClient.id, client: String(linkedClient.name || linkedClient.title || '') } : {}) }); }}><option value="">Sem projeto vinculado</option>{projects.filter((item) => { const linkedClient = findProjectClient(item, workspaceClients); const unresolvedClient = Boolean(String(item.client || '').trim() && String(item.client).trim().toLocaleLowerCase('pt-BR') !== 'sem cliente' && !linkedClient); return !draft.clientId || (linkedClient ? String(linkedClient.id) === String(draft.clientId) : !item.clientId && !unresolvedClient); }).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}{composer === 'arquivos' && <label>Projeto<input value={draft.project} onChange={(e) => setDraft({ ...draft, project: e.target.value })} placeholder="Projeto relacionado" /></label>}{composer === 'tarefas' && <div className="work-compose-grid"><label>Prazo<input type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} /></label><label>Prioridade<select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}><option>Baixa</option><option>Normal</option><option>Alta</option></select></label><label>Recorrência<select value={draft.recurrence || 'Nao recorrente'} onChange={(e) => setDraft({ ...draft, recurrence: e.target.value })}><option value="Nao recorrente">N&#227;o recorrente</option><option value="Diaria">Di&#225;ria</option><option value="Semanal">Semanal</option><option value="Mensal">Mensal</option></select></label></div>}{composer === 'projetos' && <label>Prazo<input type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} /></label>}{composer === 'agenda' && <><div className="work-compose-grid"><label>Data<input required type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} /></label><label>Horário<input required type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></label><label>Término<input required type="time" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} /></label><label>Detalhes<input value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} placeholder="Cliente ou contexto" /></label></div><label>Convidados &middot; e-mails separados por virgula<input type="text" value={draft.attendees} onChange={(e) => setDraft({ ...draft, attendees: e.target.value })} placeholder="nome@empresa.com.br" /></label><label className="work-sync-option"><input type="checkbox" checked={draft.syncGoogleCalendar} onChange={(e) => setDraft({ ...draft, syncGoogleCalendar: e.target.checked })} />Sincronizar com Google Calendar</label><label className="work-sync-option"><input type="checkbox" checked={draft.createMeet} onChange={(e) => setDraft({ ...draft, createMeet: e.target.checked })} />Criar link do Google Meet</label></>}{['tarefas', 'aprovações'].includes(composer) && <label>Responsável<input value={draft.assignee} onChange={(e) => setDraft({ ...draft, assignee: e.target.value })} /></label>}<footer><button type="button" className="work-button work-button-quiet" onClick={() => setComposer('')}>Cancelar</button><button className="work-button work-button-primary" type="submit" disabled={composer === 'agenda' && savingAgenda}><Check size={15} />{savingAgenda ? 'Salvando…' : 'Salvar'}</button></footer></form></div>}
    {toast && <div className="work-toast" role="status"><Check size={15} />{toast}<button aria-label="Fechar aviso" onClick={() => setToast('')}><X size={14} /></button></div>}
  </main>;
}

function normalizePage(page) {
  const value = String(page || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  if (['projeto', 'projetos', 'project', 'projects'].includes(value)) return 'projetos';
  if (['tarefa', 'tarefas', 'task', 'tasks'].includes(value)) return 'tarefas';
  if (['agenda', 'calendar'].includes(value)) return 'agenda';
  if (['hora', 'horas', 'hours', 'time'].includes(value)) return 'horas';
  if (['aprovacao', 'aprovacoes', 'approval', 'approvals'].includes(value)) return 'aprovacoes';
  if (['arquivos', 'arquivo', 'arquivosdrive', 'drive', 'files'].includes(value)) return 'arquivos';
  return 'projetos';
}

function Metric({ label, value, note, icon: Icon, tone }) { return <article className="work-metric"><span className={`metric-icon ${tone}`}><Icon size={17} /></span><div><small>{label}</small><strong>{value}</strong><span>{note}</span></div><ArrowUpRight size={15} className="metric-arrow" /></article>; }
function StatusPill({ status }) { const slug = status.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s/g, '-'); return <span className={`status-pill status-${slug}`}><i />{status}</span>; }
function EventDetail({ event, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState({ title: event.title || '', date: event.date || new Date().toISOString().slice(0, 10), time: event.time || '09:00', end: event.end || '09:30', detail: event.detail || '', people: event.people || '', allDay: Boolean(event.allDay) });
  return <div className="work-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><form className="work-compose-modal" onSubmit={(e) => { e.preventDefault(); onSave(draft); }}><header><div><span className="eyebrow">AGENDA ? COMPROMISSO</span><h2>{event.title}</h2></div><button type="button" aria-label="Fechar" onClick={onClose}><X size={18}/></button></header><label>Titulo<input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}/></label><div className="work-compose-grid"><label>Data<input required type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })}/></label><label className="work-sync-option"><input type="checkbox" checked={draft.allDay} onChange={(e) => setDraft({ ...draft, allDay: e.target.checked })}/>Evento de dia inteiro</label>{!draft.allDay && <><label>Inicio<input required type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })}/></label><label>Termino<input required type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })}/></label></>}<label>Participantes<input value={draft.people} onChange={(e) => setDraft({ ...draft, people: e.target.value })}/></label></div><label>Detalhes<input value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })}/></label>{event.calendarSyncStatus === 'connected' ? <p className="work-modal-note">Evento sincronizado com Google Calendar.</p> : <p className="work-modal-note">{event.calendarSyncError || (event.calendarSyncStatus === 'pending' ? 'Sincronizacao com Google Calendar em andamento.' : event.calendarSyncStatus === 'not_connected' ? 'Evento salvo no Nexo, mas sem sincronizacao com Google Calendar.' : 'Evento salvo na agenda do Nexo.')}</p>}{event.googleMeetUrl && <a className="work-meet-link" href={event.googleMeetUrl} target="_blank" rel="noreferrer">Entrar no Google Meet</a>}{event.googleHtmlLink && <a className="work-meet-link" href={event.googleHtmlLink} target="_blank" rel="noreferrer">Abrir no Google Calendar</a>}<footer><button type="button" className="work-button work-button-quiet file-remove" onClick={onDelete}>Excluir evento</button><span/><button type="button" className="work-button work-button-quiet" onClick={onClose}>Cancelar</button><button className="work-button work-button-primary"><Check size={14}/>Salvar evento</button></footer></form></div>;
}

function ApprovalDetail({ approval, onClose, onRevokeShare, onComment, onDecision }) {
  const [comment, setComment] = useState('');
  const [revision, setRevision] = useState(false);
  const submitComment = (event) => { event.preventDefault(); if (!comment.trim()) return; onComment(comment.trim()); setComment(''); };
  return <div className="work-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="work-compose-modal approval-detail-modal" role="dialog" aria-modal="true" aria-label={`Aprovação ${approval.title}`}><header><div><span className="eyebrow">APROVAÇÃO · {approval.client}</span><h2>{approval.title}</h2></div><button type="button" aria-label="Fechar" onClick={onClose}><X size={18}/></button></header><div className="approval-detail-preview"><FileText size={28}/><b>{approval.title}</b><small>{approval.kind} - {approval.project}</small>{approval.attachment?.url ? <><a href={approval.attachment.url} target="_blank" rel="noreferrer">Abrir {approval.attachment.name || 'arquivo enviado'} no Google Drive</a>{approval.attachment.permissionId && <button type="button" className="work-button work-button-quiet" onClick={() => onRevokeShare(approval)}>Revogar acesso publico</button>}</> : <span>Sem arquivo real vinculado.</span>}</div><div className="approval-detail-meta"><span>Enviado<b>{approval.sent}</b></span><span>Revisor<b>{approval.reviewer}</b></span><span>Status<b>{approval.status}</b></span></div>{approval.clientComment && <article className="project-detail-comment"><b>Resposta do cliente</b><p>{approval.clientComment}</p></article>}<form className="project-detail-add-task" onSubmit={submitComment}><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Registrar comentário ou orientação"/><button className="work-button work-button-quiet"><Send size={14}/>Comentar</button></form>{approval.comments?.map((item) => <article className="project-detail-comment" key={item.id}><b>{item.text}</b><small>{new Date(item.at).toLocaleString('pt-BR')}</small></article>)}{approval.status === 'Aguardando' && <div className="approval-detail-actions"><button className="work-button work-button-quiet" onClick={() => setRevision(true)}>Solicitar ajustes</button><button className="work-button work-button-approve" onClick={() => onDecision('Aprovado')}><Check size={14}/>Aprovar entrega</button></div>}{revision && <form className="approval-revision-form" onSubmit={(event) => { event.preventDefault(); onComment(comment.trim() || 'Ajustes solicitados pelo cliente.'); onDecision('Ajustes solicitados'); }}><textarea required value={comment} onChange={(event) => setComment(event.target.value)} rows={3} placeholder="Descreva os ajustes solicitados"/><button className="work-button work-button-quiet">Enviar pedido de ajuste</button></form>}<footer><span>Decisões e comentários salvos no workspace.</span><button type="button" className="work-button work-button-quiet" onClick={onClose}>Fechar</button></footer></section></div>;
}

function FileDetail({ file, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState({ name: file.name || '', project: file.project || '', client: file.client || '' });
  const exportMetadata = () => { const blob = new Blob([JSON.stringify({ ...file, ...draft }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${draft.name || 'arquivo'}-metadata.json`; link.click(); URL.revokeObjectURL(url); };
  return <div className="work-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="work-compose-modal file-detail-modal" role="dialog" aria-modal="true" aria-label={`Arquivo ${file.name}`}><header><div><span className="eyebrow">ARQUIVO · {file.type || 'DOCUMENTO'}</span><h2>{file.name}</h2></div><button type="button" aria-label="Fechar" onClick={onClose}><X size={18}/></button></header><div className="file-detail-meta"><span>Tipo<b>{file.folder ? 'Pasta' : file.type || 'Arquivo'}</b></span><span>Tamanho<b>{file.size || 'N\u00e3o informado'}</b></span><span>Adicionado<b>{file.date || 'Data n\u00e3o informada'}</b></span></div><div className="file-detail-fields"><label>Nome<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })}/></label><label>Projeto<input value={draft.project} onChange={(event) => setDraft({ ...draft, project: event.target.value })}/></label><label>Cliente<input value={draft.client} onChange={(event) => setDraft({ ...draft, client: event.target.value })}/></label></div><div className="ns-integration-modal-note"><ShieldCheck size={15}/>{file.driveFileId ? 'Arquivo armazenado no Google Drive. Alteracoes nesta ficha atualizam os metadados do workspace.' : 'Registro de metadados apenas; o arquivo original n\u00e3o foi enviado ao Google Drive.'}</div><footer><button type="button" className="work-button work-button-quiet file-remove" onClick={onDelete}>Remover registro</button><span/>{file.driveFileId && <a className="work-button work-button-quiet" href={`https://drive.google.com/open?id=${encodeURIComponent(file.driveFileId)}`} target="_blank" rel="noopener noreferrer"><ArrowRight size={14}/>Abrir no Drive</a>}<button type="button" className="work-button work-button-quiet" onClick={exportMetadata}><Download size={14}/>Exportar metadados</button><button type="button" className="work-button work-button-primary" onClick={() => onSave(draft)}><Check size={14}/>Salvar</button></footer></section></div>;
}

function TaskDetail({ task, tasks, onClose, onSave, onFileUploaded, onAction }) {
  const [draft, setDraft] = useState({ ...task, checklist: task.checklist || [], comments: task.comments || [], description: task.description || '', recurrence: task.recurrence || 'Nao recorrente', estimatedMinutes: task.estimatedMinutes || '', dependency: task.dependency || '', attachment: task.attachment || '' });
  const [subtask, setSubtask] = useState('');
  const [comment, setComment] = useState('');
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const checklist = draft.checklist.map((item) => typeof item === 'string' ? { title: item, done: false } : item);
  const save = (event) => { event?.preventDefault(); onSave({ ...draft, checklist, updatedAt: new Date().toISOString() }); onAction('Tarefa atualizada e salva.'); onClose(); };
  const uploadAttachment = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.size || file.size > 8 * 1024 * 1024) { onAction('O arquivo precisa ter até 8 MiB.'); event.target.value = ''; return; }
    setUploadingAttachment(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.')); reader.onload = () => resolve(String(reader.result || '')); reader.readAsDataURL(file); });
      const result = await apiRequest('/api/integrations/google/drive/upload', { method: 'POST', body: JSON.stringify({ name: file.name, mimeType: file.type || 'application/octet-stream', data: dataUrl.slice(dataUrl.indexOf(',') + 1), taskId: task.id }) });
      const updated = { ...draft, attachment: result.data, updatedAt: new Date().toISOString() };
      setDraft(updated); onSave(updated); onFileUploaded?.(result.data); onAction(`Anexo enviado ao Drive e vinculado à tarefa: ${result.data.name}`);
    } catch (error) { onAction(error.message || 'Não foi possível enviar o anexo ao Google Drive.'); }
    finally { setUploadingAttachment(false); event.target.value = ''; }
  };
  const addSubtask = (event) => { event.preventDefault(); if (!subtask.trim()) return; setDraft({ ...draft, checklist: [...checklist, { id: Date.now(), title: subtask.trim(), done: false }] }); setSubtask(''); };
  const addComment = (event) => { event.preventDefault(); if (!comment.trim()) return; setDraft({ ...draft, comments: [{ id: Date.now(), text: comment.trim(), at: new Date().toISOString() }, ...draft.comments] }); setComment(''); };
  return <div className="work-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="work-compose-modal task-detail-modal"><header><div><span className="eyebrow">TAREFA · {draft.client || 'SEM CLIENTE'}</span><h2>{draft.title}</h2></div><button type="button" aria-label="Fechar" onClick={onClose}><X size={18}/></button></header><div className="task-detail-fields"><label>Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>{['A fazer','Em andamento','Concluída'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Prioridade<select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>{['Baixa','Normal','Alta','Urgente'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Respons&#225;vel<input value={draft.assignee || ''} onChange={(event) => setDraft({ ...draft, assignee: event.target.value })}/></label><label>Prazo<input value={draft.due || ''} onChange={(event) => setDraft({ ...draft, due: event.target.value })} placeholder="Ex.: 30 set"/></label><label>Tempo estimado (minutos)<input type="number" min="0" value={draft.estimatedMinutes} onChange={(event) => setDraft({ ...draft, estimatedMinutes: event.target.value })}/></label><label>Recorr&#234;ncia<select value={draft.recurrence} onChange={(event) => setDraft({ ...draft, recurrence: event.target.value })}>{['Nao recorrente','Diaria','Semanal','Mensal'].map((value) => <option key={value} value={value}>{value === 'Nao recorrente' ? 'N' + String.fromCharCode(227) + 'o recorrente' : value === 'Diaria' ? 'Di' + String.fromCharCode(225) + 'ria' : value}</option>)}</select></label><label>Depende de<select value={draft.dependency} onChange={(event) => setDraft({ ...draft, dependency: event.target.value })}><option value="">Sem depend&#234;ncia</option>{tasks.filter((item) => item.id !== task.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className="task-detail-wide">Descri&#231;&#227;o<textarea rows="3" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })}/></label></div><section className="project-detail-section"><div className="project-detail-heading"><div><h3>Checklist e subtarefas</h3><p>{checklist.filter((item) => item.done).length} de {checklist.length} conclu&#237;das</p></div></div><form className="project-detail-add-task" onSubmit={addSubtask}><input value={subtask} onChange={(event) => setSubtask(event.target.value)} placeholder="Adicionar uma subtarefa"/><button className="work-button work-button-quiet"><Plus size={14}/>Adicionar</button></form>{checklist.map((item,index) => <label className="task-subtask" key={item.id || `${item.title}-${index}`}><input type="checkbox" checked={Boolean(item.done)} onChange={(event) => setDraft({ ...draft, checklist: checklist.map((current,i) => i === index ? { ...current, done: event.target.checked } : current) })}/><span>{item.title}</span></label>)}</section><section className="project-detail-section"><div className="project-detail-heading"><div><h3>Coment&#225;rios</h3><p>Atualiza&#231;&#245;es registradas nesta tarefa</p></div></div><form className="project-detail-add-task" onSubmit={addComment}><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Adicionar comentario"/><button className="work-button work-button-quiet"><Send size={14}/>Registrar</button></form>{draft.comments.map((item) => <article className="project-detail-comment" key={item.id}><b>{item.text}</b><small>{new Date(item.at).toLocaleString('pt-BR')}</small></article>)}</section><div className="task-detail-attachment"><label>Anexar arquivo ao Google Drive<input type="file" disabled={uploadingAttachment} onChange={uploadAttachment}/></label>{uploadingAttachment && <small role="status">Enviando e vinculando &#224; tarefa&#8230;</small>}{draft.attachment && typeof draft.attachment === 'object' && <a href={draft.attachment.url} target="_blank" rel="noreferrer">{draft.attachment.name} &#183; Abrir no Google Drive</a>}{draft.attachment && typeof draft.attachment !== 'object' && <small>{draft.attachment} &#183; refer&#234;ncia antiga, ainda n&#227;o enviada.</small>}</div><footer><span>Alterações sincronizadas ao salvar.</span><button type="button" className="work-button work-button-quiet" onClick={onClose}>Cancelar</button><button type="button" className="work-button work-button-primary" onClick={save}><Check size={14}/>Salvar tarefa</button></footer></section></div>;
}

function ProjectDetail({ project, clients, tasks, onClose, onUpdate, onTaskToggle, onAddTask, onAction }) {
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState(() => ({ status: project.status || 'A fazer', due: project.due || '', team: (project.team || []).filter(Boolean).join(', '), progress: Number(project.progress) || 0 }));
  useEffect(() => { setDetails({ status: project.status || 'A fazer', due: project.due || '', team: (project.team || []).filter(Boolean).join(', '), progress: Number(project.progress) || 0 }); }, [project.id]);
  const comments = project.comments || [];
  const addTask = async (event) => { event.preventDefault(); if (!title.trim()) return; const client = findProjectClient(project, clients); const result = await onAddTask({ id: Date.now(), title: title.trim(), project: project.name, projectId: project.id, client: client?.name || client?.title || project.client, clientId: client?.id || project.clientId || '', due: project.due || 'A definir', assignee: (project.team || []).filter(Boolean)[0] || '', status: 'A fazer', priority: 'Normal' }); if (result?.ok === false) { onAction(result.error?.message || 'N\u00e3o foi poss\u00edvel adicionar a tarefa.'); return; } setTitle(''); onAction('Tarefa adicionada ao projeto.'); };
  const addComment = async (event) => { event.preventDefault(); if (!comment.trim()) return; const result = await onUpdate({ comments: [{ id: Date.now(), text: comment.trim(), at: new Date().toISOString() }, ...comments] }); if (result === false) return; setComment(''); onAction('Coment\u00e1rio salvo no projeto.'); };
  const saveDetails = async () => { setSaving(true); try { const result = await onUpdate({ status: details.status, due: details.due.trim(), team: details.team.split(',').map((item) => item.trim()).filter(Boolean), progress: Number(details.progress) || 0 }); if (result !== false) onAction('Detalhes do projeto atualizados.'); } finally { setSaving(false); } };
  return <div className="work-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="work-compose-modal project-detail-modal" role="dialog" aria-modal="true" aria-label={`Projeto ${project.name}`}><header><div><span className="eyebrow">PROJETO · {project.client}</span><h2>{project.name}</h2></div><button type="button" aria-label="Fechar" onClick={onClose}><X size={18}/></button></header><div className="project-detail-fields"><label>Etapa<select value={details.status} onChange={(event) => setDetails((current) => ({ ...current, status: event.target.value }))}>{['A fazer', 'Em andamento', 'Aguardando cliente', 'Conclu\u00eddo'].map((status) => <option key={status}>{status}</option>)}</select></label><label>Prazo<input value={details.due} onChange={(event) => setDetails((current) => ({ ...current, due: event.target.value }))} placeholder="Ex.: 15 out" /></label><label>Respons&#225;veis<input value={details.team} onChange={(event) => setDetails((current) => ({ ...current, team: event.target.value }))} placeholder="Separe os nomes por v&#237;rgula" /></label><label>Progresso &#183; {details.progress}%<input type="range" min="0" max="100" value={details.progress} onChange={(event) => setDetails((current) => ({ ...current, progress: Number(event.target.value) }))} /></label></div><section className="project-detail-section"><div className="project-detail-heading"><div><h3>Tarefas do projeto</h3><p>{tasks.filter((task) => task.status === 'Concluída').length} de {tasks.length} concluídas</p></div></div><form className="project-detail-add-task" onSubmit={addTask}><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Adicionar tarefa ao projeto"/><button className="work-button work-button-primary"><Plus size={14}/>Adicionar</button></form><div className="project-detail-task-list">{tasks.map((task) => <button type="button" key={task.id} className={task.status === 'Concluída' ? 'done' : ''} onClick={() => onTaskToggle(task.id)}><span>{task.status === 'Concluída' ? <CheckCircle2 size={16}/> : <Circle size={16}/>}</span><b>{task.title}</b><small>{task.due || 'Sem prazo'} · {task.assignee || 'Sem responsável'}</small></button>)}{!tasks.length && <p>Este projeto ainda não possui tarefas vinculadas.</p>}</div></section><section className="project-detail-section"><div className="project-detail-heading"><div><h3>Comentários e decisões</h3><p>Notas internas salvas com este projeto.</p></div></div><form className="project-detail-add-task" onSubmit={addComment}><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Registrar uma atualização"/><button className="work-button work-button-quiet"><Send size={14}/>Comentar</button></form>{comments.map((item) => <article className="project-detail-comment" key={item.id}><b>{item.text}</b><small>{new Date(item.at).toLocaleString('pt-BR')}</small></article>)}</section><footer><span>{saving ? 'Salvando detalhes...' : 'Revise os campos e salve as altera\u00e7\u00f5es.'}</span><button type="button" className="work-button work-button-quiet" onClick={onClose}>Fechar</button><button type="button" className="work-button work-button-primary" disabled={saving} onClick={saveDetails}><Check size={14} />Salvar altera&#231;&#245;es</button></footer></section></div>;
}

function ProjectCard({ project, onOpen }) { return <article className={`project-card project-${project.tone}`}><div className="project-card-top"><span className="project-type"><i />{project.type}</span><button className="row-more" aria-label={`Mais opções para ${project.name}`} onClick={onOpen}><MoreHorizontal size={18} /></button></div><button className="project-name" onClick={onOpen}>{project.name}<ArrowUpRight size={15} /></button><p className="project-client">{project.client}</p><div className="project-progress-label"><span>Progresso</span><strong>{project.progress}%</strong></div><div className="project-progress"><i style={{ width: `${project.progress}%` }} /></div><div className="project-card-bottom"><StatusPill status={project.status} /><span className="project-due"><CalendarDays size={13} />{project.due}</span><div className="avatar-stack">{project.team.map((person) => <Avatar key={person} name={person} />)}</div></div></article>; }
function Empty({ title, text }) { return <div className="work-empty"><span><Sparkles size={18} /></span><strong>{title}</strong><p>{text}</p></div>; }
function FileCard({ file, onOpen, onMenu }) { const Icon = file.folder ? Folder : file.type === 'image' ? FileImage : FileText; return <article className="drive-card"><button className={`file-art ${file.folder ? 'file-folder' : `file-${file.type}`}`} onClick={onOpen}><Icon size={file.folder ? 30 : 27} strokeWidth={1.6} />{!file.folder && <span>{file.type.toUpperCase()}</span>}</button><div className="drive-card-copy"><button className="file-name" onClick={onOpen}>{file.name}</button><small>{file.client} <span>·</span> {file.date}</small></div><button className="row-more" aria-label={`Mais opções para ${file.name}`} onClick={onMenu}><MoreHorizontal size={18} /></button></article>; }

export { WorkScreen };
export default WorkScreen;
