import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Check,
  CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Circle, Clock3,
  Download, File, FileImage, FileText, Filter, Folder, FolderOpen,
  LayoutGrid, List, MoreHorizontal, Paperclip, Plus, Search, Send,
  SlidersHorizontal, Sparkles, Timer, Upload, Users, X, ShieldCheck, RefreshCw,
} from 'lucide-react';
import './work.css';
import './drive-scope.css';
import { apiRequest, fetchAllRecords } from '../lib/workspace-api.js';
import { useWorkspacePreferences } from '../lib/workspace-preferences.js';
import { completeTaskOccurrence } from '../lib/task-recurrence.js';
import { saveTaskDetailsOnce } from '../lib/task-edit-transition.js';
import { taskIsCompleted, taskMatchesStatus, taskStatusForEdit, withTaskStatus } from '../lib/task-status.js';
import { taskDependencyBlocker, taskDependencyBlockMessage, tasksDependingOn } from '../lib/task-dependency.js';
import { parseAgendaAttendees, validateAgendaAttendees, validateAgendaEvent } from '../lib/agenda-event-validation.js';
import { agendaEventDurationMinutes, agendaEventEndDate } from '../lib/agenda-event-interval.js';
import { isAgendaAllDayEvent } from '../lib/agenda-event-presentation.js';
import { agendaNavigationEventDate, resolveAgendaNavigationEvent } from '../lib/agenda-navigation.js';
import { findProjectClient } from '../lib/project-client-link.js';
import { findProjectForTask, taskBelongsToProject } from '../lib/project-task-link.js';
import { summarizeProjectTasks } from '../lib/project-task-progress.js';
import { sortFilesByName, sortFilesByRecent } from '../lib/file-sort.js';
import { classifyWorkspaceFile, matchesWorkspaceFileFilter } from '../lib/file-category.js';
import { buildLinkedDriveFileRecord, fileAssociationDraft, resolveFileAssociation } from '../lib/file-association.js';
import { formatDriveFileSize } from '../lib/drive-file-presentation.js';
import { resolveFileUploadScopeLink } from '../lib/file-upload-scope.js';
import { formatHoursEntryEnd, hoursDateRange, hoursEntryIsInDateRange } from '../lib/hours-entry-date.js';
import { hoursEntryDurationInput, updateHoursEntryDuration } from '../lib/hours-entry-duration.js';
import { buildManualHoursInterval } from '../lib/manual-hours-interval.js';
import { calendarDateInTimeZone, calendarTimeZoneLabel, calendarWeekdayLabels, startOfCalendarWeek } from '../lib/calendar-preferences.js';
import { downloadCsvFile, rowsToCsv } from '../lib/csv.js';
import { isLocalDemoActive } from '../lib/local-demo.js';
import { createSequentialQueue } from '../lib/sequential-queue.js';
import { safeLowercase } from '../lib/safe-lowercase.js';
import { isApprovalAwaitingDecision, isApprovalPending } from '../lib/approval-status.js';
import { canCreateWorkRecord } from '../lib/work-screen-actions.js';
import { nextAgendaEventTime, upcomingAgendaEvents } from '../lib/agenda-upcoming.js';
import { googleCalendarErrorAction } from '../lib/google-calendar-error.js';
import { matchesWorkSearch } from '../lib/work-search.js';
import { recoverWorkspaceRecordsAfterFailure } from '../lib/workspace-mutation-recovery.js';
import { recoverApprovalShareAfterSaveFailure } from '../lib/approval-save-recovery.js';
import { withoutTaskAttachment } from '../lib/task-attachment.js';
import { countActiveWorkProjects } from '../lib/work-project-activity.js';
import { resolveCreatedWorkspaceRecord } from '../lib/workspace-created-record.js';
import { buildTaskRecord } from '../lib/task-create.js';
import { projectTemplateChoices, buildProjectTemplateTasks } from '../lib/project-templates.js';
import { buildAgendaRecurrenceSeries } from '../lib/agenda-recurrence.js';
import { shouldOpenFileDetailsByDefault } from '../lib/file-primary-action.js';
import { createAsyncActionLock } from '../lib/async-action-lock.js';
import { createKeyedActionLock } from '../lib/keyed-action-lock.js';
import { submitApprovalComment } from '../lib/approval-comment-action.js';

function projectIsCompleted(project) {
  const status = String(project?.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return ['concluida', 'concluido', 'completed', 'done'].includes(status);
}

function projectIsArchived(project) {
  return String(project?.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() === 'arquivado';
}

function countText(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function approvalFileKind(file) {
  const type = String(file?.mimeType || file?.type || '').toLocaleLowerCase('pt-BR');
  if (type.includes('image') || type.includes('imagem')) return 'Imagem';
  if (type.includes('pdf')) return 'PDF';
  return 'Arquivo';
}

function approvalFileMatchesClient(file, clientId, projects, clients, localDemo) {
  if (!file || file.folder) return false;
  if (localDemo) return true;
  if (!file.driveFileId || !file.url) return false;
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
  const client = clients.find((item) => String(item.id) === String(clientId));
  const clientName = normalize(client?.name || client?.title);
  const fileClientId = file.clientId == null ? '' : String(file.clientId);
  const fileClient = normalize(file.client);
  if (fileClientId && fileClientId !== String(clientId)) return false;
  if (fileClient && fileClient !== 'sem cliente' && clientName && fileClient !== clientName) return false;
  const project = projects.find((item) => (file.projectId && String(item.id) === String(file.projectId)) || (file.project && normalize(item.name) === normalize(file.project)));
  const projectClient = project && findProjectClient(project, clients);
  if (projectClient && String(projectClient.id) !== String(clientId)) return false;
  return true;
}

function useLocalState(key, fallback) {
  const resource = ({ 'nexo.work.projects.v1': 'projects', 'nexo.work.tasks.v1': 'tasks', 'nexo.work.events.v1': 'events', 'nexo.work.approvals.v1': 'approvals', 'nexo.work.files.v1': 'files', 'nexo.work.hours.v1': 'hours' })[key];
  const [value, setValue] = useState([]);
  const valueRef = useRef(value);
  const [syncError, setSyncError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setLoaded(false);
    fetchAllRecords(`/api/workspace/${resource}`).then((records) => { if (active) { valueRef.current = records; setValue(valueRef.current); setSyncError(''); setLoaded(true); } })
      .catch((error) => { if (active) { setSyncError(error.message || 'Falha ao carregar registros.'); setLoaded(true); window.dispatchEvent(new CustomEvent('nexo:workspace-error', { detail: error.message })); } });
    return () => { active = false; };
  }, [resource, reloadVersion]);
  const refresh = () => setReloadVersion((version) => version + 1);
  const persist = (nextOrUpdater) => {
    const previous = valueRef.current;
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(previous) : nextOrUpdater;
    valueRef.current = next; setValue(next);
    const oldById = new Map(previous.map((item) => [String(item.id), item]));
    const newById = new Map(next.map((item) => [String(item.id), item]));
    const createdIds = {};
    const recordData = (item) => Object.fromEntries(Object.entries(item).filter(([field]) => !['id', 'createdAt', 'updatedAt'].includes(field)));
    return Promise.all([
      ...next.filter((item) => !oldById.has(String(item.id))).map(async (item) => {
        const tempId = String(item.id);
        const saved = await apiRequest(`/api/workspace/${resource}`, { method: 'POST', body: JSON.stringify({ data: recordData(item) }) });
        if (saved.data?.id) createdIds[tempId] = String(saved.data.id);
        valueRef.current = valueRef.current.map((row) => String(row.id) === tempId || String(row.id) === String(saved.data.id) ? saved.data : row); setValue(valueRef.current);
      }),
      ...next.filter((item) => oldById.has(String(item.id)) && JSON.stringify(recordData(item)) !== JSON.stringify(recordData(oldById.get(String(item.id))))).map((item) => apiRequest(`/api/workspace/${resource}/${item.id}`, { method: 'PATCH', body: JSON.stringify({ data: recordData(item) }) })),
      ...previous.filter((item) => !newById.has(String(item.id))).map((item) => apiRequest(`/api/workspace/${resource}/${item.id}`, { method: 'DELETE' })),
    ]).then(() => { setSyncError(''); return { ok: true, records: valueRef.current, createdIds }; }).catch(async (error) => {
      const recovery = await recoverWorkspaceRecordsAfterFailure(fetchAllRecords, resource, previous);
      if (recovery.recovered) {
        valueRef.current = recovery.records;
        setValue(recovery.records);
      } else if (valueRef.current === next) {
        valueRef.current = previous;
        setValue(previous);
      }
      const message = error.message || 'Falha ao salvar.';
      setSyncError(recovery.recovered ? message : `${message} N\u00e3o foi poss\u00edvel confirmar o estado salvo; atualize a tela.`);
      window.dispatchEvent(new CustomEvent('nexo:workspace-error', { detail: message }));
      return { ok: false, error, recovered: recovery.recovered, records: recovery.records };
    });
  };
  return [value, persist, syncError, loaded, refresh];
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
  const initials = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  return <span className={`work-avatar ${className}`} aria-label={name} title={name}>{initials}</span>;
}
function toLocalDateInput(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function nextCalendarDate(date) { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10); }
function calendarEndDate(date, start, end) { return agendaEventEndDate(date, start, end); }

function AgendaTimeGrid({ dates, events, selectedDate, now, timeZone, locale, onSelectDate, onCreateEvent, onSelectEvent, eventTone, sameDay }) {
  const firstHour = 7, lastHour = 21, hourHeight = 64;
  const keyOf = (date) => toLocalDateInput(date);
  const dayEvents = (date, allDay) => events.filter((event) => event.date === keyOf(date) && isAgendaAllDayEvent(event) === allDay);
  const hasEvents = dates.some((date) => events.some((event) => event.date === keyOf(date)));
  const offset = (event) => { const [hour, minute] = event.time.split(':').map(Number); return Math.max(0, Math.min((lastHour - firstHour) * hourHeight - 30, ((hour - firstHour) * 60 + minute) / 60 * hourHeight)); };
  const height = (event) => { const [sh, sm] = event.time.split(':').map(Number); const fallbackEnd = `${String((sh + 1) % 24).padStart(2, '0')}:${String(sm).padStart(2, '0')}`; return Math.max(34, Math.min(240, agendaEventDurationMinutes(event.time, event.end || fallbackEnd) / 60 * hourHeight)); };
  return <div className={`agenda-time-grid ${dates.length === 1 ? 'is-day' : 'is-week'}`}>
    <div className="agenda-time-header"><div className="agenda-time-gutter-label">{calendarTimeZoneLabel(new Date(), locale, timeZone)}</div>{dates.map((date) => <button type="button" key={keyOf(date)} className={`agenda-time-date ${sameDay(date, selectedDate) ? 'selected' : ''} ${sameDay(date, now) ? 'is-today' : ''}`} onClick={() => onSelectDate(date)}><span>{date.toLocaleDateString(locale, { weekday: 'short' })}</span><b>{date.getDate()}</b></button>)}</div>
    <div className="agenda-all-day-row"><span>Dia todo</span>{dates.map((date) => <div key={keyOf(date)}>{dayEvents(date, true).map((event) => <button key={event.id} type="button" className={`agenda-grid-allday tone-${eventTone(event)}`} onClick={() => onSelectEvent(event)}>{event.title}</button>)}</div>)}</div>
    {!hasEvents && <div className="agenda-grid-empty"><span><CalendarDays size={17}/></span><div><b>Agenda livre</b><small>Selecione um horário na grade para criar seu próximo compromisso.</small></div><button type="button" onClick={() => onCreateEvent(selectedDate)}><Plus size={14}/> Novo evento</button></div>}
    <div className="agenda-time-scroll"><div className="agenda-time-axis">{Array.from({ length: lastHour - firstHour }, (_, i) => <span key={i}>{String(firstHour + i).padStart(2, '0')}:00</span>)}</div><div className="agenda-time-columns">{dates.map((date) => <div className={`agenda-time-column ${sameDay(date, now) ? 'is-today' : ''}`} key={keyOf(date)}><div className="agenda-time-slots">{Array.from({ length: lastHour - firstHour }, (_, i) => <button type="button" key={i} aria-label={`Criar compromisso às ${String(firstHour + i).padStart(2, '0')}:00`} onClick={() => onCreateEvent(date, `${String(firstHour + i).padStart(2, '0')}:00`)} />)}</div>{dayEvents(date, false).map((event) => <button type="button" key={event.id} className={`agenda-grid-event tone-${eventTone(event)}`} style={{ top: offset(event), height: height(event) }} onClick={() => onSelectEvent(event)}><small>{event.time}{event.end ? `–${event.end}` : ''}</small><b>{event.title}</b>{event.detail && <span>{event.detail}</span>}</button>)}</div>)}</div></div>
  </div>;
}

function AgendaCalendar({ events, selectedDate, setSelectedDate, agendaView, setAgendaView, agendaQuery, setAgendaQuery, calendarSyncBusy, calendarSyncError, calendarSyncErrorCode, calendarSyncedAt, localDemo, timeZone, weekStartPreference, locale, onSyncGoogleCalendar, onSelectEvent, onCreateEvent }) {
  const monthDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const monthDays = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
  const firstWeekday = weekStartPreference === 'sunday' ? 0 : 1;
  const monthStart = (monthDate.getDay() - firstWeekday + 7) % 7;
  const weekStart = startOfCalendarWeek(selectedDate, weekStartPreference);
  const selectedKey = toLocalDateInput(selectedDate);
  const filteredEvents = events.filter((event) => matchesWorkSearch([event.title, event.detail, event.client, event.people], agendaQuery, locale));
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
    if (!event.time || event.allDay) return 0;
    if (!event.end) return Math.max(0, Number(event.durationMinutes ?? event.duration) || 0);
    return agendaEventDurationMinutes(event.time, event.end);
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
  const nowInstant = new Date();
  const now = calendarDateInTimeZone(nowInstant, timeZone);
  const isToday = sameDay(now, selectedDate);
  const eventTone = (event) => ['blue', 'lime', 'violet'].includes(event.color) ? event.color : 'blue';
  const weekdays = calendarWeekdayLabels(locale, weekStartPreference);
  const title = agendaView === 'Mês'
    ? monthDate.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
    : agendaView === 'Semana'
      ? `${weekStart.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`
      : selectedDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const eventDate = (date) => { const [year, month, day] = date.split('-').map(Number); return new Date(year, month - 1, day); };
  const openEvent = (event) => { setSelectedDate(eventDate(event.date)); onSelectEvent(event); };
  const monthDates = Array.from({ length: monthDays }, (_, index) => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), index + 1));
  const upcomingEvents = upcomingAgendaEvents(filteredEvents, { now: nowInstant, timeZone, fromDateKey: selectedKey }).slice(0, 4);
  const changeMiniMonth = (direction) => { const day = selectedDate.getDate(); const next = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + direction, 1); next.setDate(Math.min(day, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate())); setSelectedDate(next); };

  return <div className="agenda-workspace agenda-v2">
    <div className="agenda-toolbar agenda-toolbar-new">
      <div className="agenda-period"><button type="button" aria-label="Período anterior" onClick={() => movePeriod(-1)}><ChevronLeft size={17} /></button><div><strong>{title}</strong><small>{periodSummary}</small></div><button type="button" aria-label="Próximo período" onClick={() => movePeriod(1)}><ChevronRight size={17} /></button><button type="button" className="agenda-today" onClick={() => setSelectedDate(calendarDateInTimeZone(new Date(), timeZone))}>Ir para hoje</button></div>
      <div className="agenda-toolbar-tools"><button type="button" className="agenda-google-sync" onClick={onSyncGoogleCalendar} disabled={calendarSyncBusy || localDemo} title={calendarSyncedAt ? `Ultima leitura: ${calendarSyncedAt}` : "Ler eventos do Google Calendar"}><RefreshCw size={14} className={calendarSyncBusy ? "agenda-spin" : ""}/><span>{localDemo ? "Google desativado" : calendarSyncBusy ? "Sincronizando..." : "Atualizar Google"}</span></button><div className="agenda-mode" aria-label="Visualizacao da agenda">{["Dia", "Semana", "M\u00eas"].map((mode) => <button type="button" key={mode} aria-pressed={agendaView === mode} className={agendaView === mode ? "active" : ""} onClick={() => setAgendaView(mode)}>{mode}</button>)}</div><label className="agenda-search"><Search size={15} /><input aria-label="Buscar evento ou cliente" placeholder="Buscar na agenda" value={agendaQuery} onChange={(event) => setAgendaQuery(event.target.value)} />{agendaQuery && <button type="button" aria-label="Limpar busca" onClick={() => setAgendaQuery("")}><X size={14} /></button>}</label></div>
    </div>
    <section className="agenda-main agenda-main-new agenda-main-rebuilt agenda-main-single agenda-v2-layout">
      <aside className="agenda-v2-side">
        <div className="agenda-v2-mini-head"><b>{monthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</b><div><button type="button" aria-label="Mês anterior" onClick={() => changeMiniMonth(-1)}><ChevronLeft size={15}/></button><button type="button" aria-label="Próximo mês" onClick={() => changeMiniMonth(1)}><ChevronRight size={15}/></button></div></div>
        <div className="agenda-v2-mini-grid">{weekdays.map((day) => <span key={day}>{day.slice(0, 1)}</span>)}{Array.from({ length: monthStart }, (_, i) => <i key={`blank-${i}`} />)}{monthDates.map((date) => { const key = toLocalDateInput(date); const count = filteredEvents.filter((event) => event.date === key).length; return <button type="button" key={key} aria-label={`${date.toLocaleDateString('pt-BR')}${count ? `, ${count} compromissos` : ''}`} className={`${sameDay(date, selectedDate) ? 'selected' : ''} ${sameDay(date, now) ? 'is-today' : ''}`} onClick={() => setSelectedDate(date)}>{date.getDate()}{count > 0 && <i />}</button>; })}</div>
        <div className="agenda-v2-upcoming"><div className="agenda-v2-section-title"><b>Próximos</b><span>{upcomingEvents.length}</span></div>{upcomingEvents.map((event) => <button type="button" key={event.id} onClick={() => openEvent(event)}><i className={`tone-${eventTone(event)}`} /><span><b>{event.title}</b><small>{event.date === selectedKey ? 'Hoje' : eventDate(event.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {event.time || 'Dia todo'}</small></span><ChevronRight size={14}/></button>)}{!upcomingEvents.length && <p>Nenhum compromisso próximo.</p>}</div>
        <div className={`agenda-v2-connection ${calendarSyncError && !localDemo ? 'has-error' : ''} ${localDemo ? 'is-demo' : ''}`}><span className="agenda-v2-connection-dot"/><div><b>{localDemo ? 'Demonstração local' : calendarSyncError ? 'Google precisa de atenção' : 'Google Calendar'}</b><small>{localDemo ? 'Eventos de exemplo · sincronização externa desativada' : calendarSyncError || (calendarSyncedAt ? `Atualizado às ${calendarSyncedAt}` : 'Sincronize para buscar eventos')}</small></div></div>
      </aside>
      <div className="agenda-view-area agenda-view-area-new">
        <div className="agenda-view-heading"><div><span>{agendaView === 'Dia' ? (isToday ? 'HOJE' : 'DIA SELECIONADO') : agendaView === 'Semana' ? 'SEMANA' : 'MÊS'}</span><h3>{agendaView === 'Dia' ? (isToday ? 'Compromissos de hoje' : selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })) : agendaView === 'Semana' ? 'Sua semana' : title}</h3><small>{periodSummary}</small></div><span className="agenda-view-hint">Selecione um compromisso para ver ou editar</span></div>
        <div className="agenda-v2-stats"><div><small>{agendaView === 'Dia' ? 'Compromissos do dia' : 'Compromissos do período'}</small><b>{visibleEvents.length}</b></div><div><small>Tempo reservado</small><b>{visibleDuration}</b></div><div><small>{agendaView === 'Dia' ? 'Próximo horário' : 'Primeiro horário'}</small><b>{agendaView === 'Dia' ? nextAgendaEventTime(visibleEvents, selectedKey, { now: nowInstant, timeZone }) || 'Livre' : visibleEvents.find((event) => event.time)?.time || 'Livre'}</b></div></div>
        {calendarSyncError && !localDemo && <div className="agenda-sync-error" role="status"><CalendarDays size={15}/><span>{calendarSyncError}</span><button type="button" onClick={() => { const action = googleCalendarErrorAction(calendarSyncErrorCode); if (action === 'reauthorize') window.location.assign('/api/integrations/google/authorize'); else if (action === 'open_integrations') window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Integrações' })); else onSyncGoogleCalendar(); }}>{googleCalendarErrorAction(calendarSyncErrorCode) === 'reauthorize' ? 'Reautorizar Google' : googleCalendarErrorAction(calendarSyncErrorCode) === 'open_integrations' ? 'Abrir Integrações' : 'Tentar novamente'}</button></div>}
        {agendaView === 'Dia' && <AgendaTimeGrid dates={[selectedDate]} events={filteredEvents} selectedDate={selectedDate} now={now} timeZone={timeZone} locale={locale} onSelectDate={setSelectedDate} onCreateEvent={onCreateEvent} onSelectEvent={onSelectEvent} eventTone={eventTone} sameDay={sameDay} />}
        {agendaView === 'Semana' && <AgendaTimeGrid dates={Array.from({ length: 7 }, (_, index) => weekDate(index))} events={filteredEvents} selectedDate={selectedDate} now={now} timeZone={timeZone} locale={locale} onSelectDate={(date) => { setSelectedDate(date); setAgendaView('Dia'); }} onCreateEvent={onCreateEvent} onSelectEvent={openEvent} eventTone={eventTone} sameDay={sameDay} />}
        {agendaView === 'Mês' && <div className="agenda-month-view agenda-month-view-new">{weekdays.map((day, index) => <b key={day + index}>{day}</b>)}{Array.from({ length: monthStart }, (_, i) => <span key={`empty-${i}`} />)}{Array.from({ length: monthDays }, (_, i) => { const day = i + 1; const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), day); const items = monthItems(day); return <button type="button" key={day} className={`${sameDay(date, selectedDate) ? 'selected' : ''} ${sameDay(date, now) ? 'is-today' : ''}`} onClick={() => { setSelectedDate(date); setAgendaView('Dia'); }}><strong>{day}</strong>{items.slice(0, 3).map((event) => <span key={event.id} className={`agenda-month-event tone-${eventTone(event)}`}>{event.time || ''} {event.title}</span>)}{items.length > 3 && <small>+{items.length - 3} outros</small>}</button>; })}</div>}
      </div>
    </section>
  </div>;
}

function WorkScreen({ page, navigationContext = null, onNavigationContextConsumed = () => {} }) {
  const preferences = useWorkspacePreferences();
  const localDemo = isLocalDemoActive();
  const key = normalizePage(page);
  const currentWorkspaceUser = (() => { try { return JSON.parse(sessionStorage.getItem('nexo.api.user') || 'null'); } catch { return null; } })();
  const isMember = currentWorkspaceUser?.role === 'member';
  const fileRecordScope = currentWorkspaceUser?.permissions?.scope;
  const fileUploadScopeRequired = fileRecordScope?.mode === 'selected';
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
  const [projects, setProjects, projectsError, projectsLoaded, refreshProjects] = useLocalState('nexo.work.projects.v1', projectsSeed);
  const [tasks, setTasks, tasksError, tasksLoaded, refreshTasks] = useLocalState('nexo.work.tasks.v1', tasksSeed);
  const [events, setEvents, eventsError, eventsLoaded, refreshEvents] = useLocalState('nexo.work.events.v1', eventsSeed);
  const [approvals, setApprovals, approvalsError, approvalsLoaded] = useLocalState('nexo.work.approvals.v1', approvalsSeed);
  const approvalActionLocks = useRef(null);
  if (!approvalActionLocks.current) approvalActionLocks.current = createKeyedActionLock();
  const taskCompletionLocks = useRef(null);
  if (!taskCompletionLocks.current) taskCompletionLocks.current = createKeyedActionLock();
  const taskDetailSaveLocks = useRef(null);
  if (!taskDetailSaveLocks.current) taskDetailSaveLocks.current = createKeyedActionLock();
  const [workspaceClients, setWorkspaceClients] = useState([]);
  const [files, setFiles, filesError, filesLoaded, refreshFiles] = useLocalState('nexo.work.files.v1', filesSeed);
  const [hours, setHours, hoursError, hoursLoaded, refreshHours] = useLocalState('nexo.work.hours.v1', []);
  const [hoursPeriod, setHoursPeriod] = useState('Esta semana');
  const [timerBusy, setTimerBusy] = useState(false);
  const timerActionLockRef = useRef(null);
  if (!timerActionLockRef.current) timerActionLockRef.current = createAsyncActionLock();
  const [hoursTaskId, setHoursTaskId] = useState('');
  const [hoursQuery, setHoursQuery] = useState('');
  const [hoursSearchOpen, setHoursSearchOpen] = useState(false);
  const [approvalQuery, setApprovalQuery] = useState('');
  const [approvalSearchOpen, setApprovalSearchOpen] = useState(false);
  const [hourEditor, setHourEditor] = useState(null);
  const [hourEditDraft, setHourEditDraft] = useState({ taskId: '', hours: '' });
  const [hourComposerOpen, setHourComposerOpen] = useState(false);
  const [hourManualDraft, setHourManualDraft] = useState(() => ({ taskId: '', date: toLocalDateInput(new Date()), start: '09:00', end: '10:00' }));
  const [fileQuery, setFileQuery] = useState('');
  const [fileUploadScopeTarget, setFileUploadScopeTarget] = useState('');
  const [fileType, setFileType] = useState('Todos');
  const [fileSort, setFileSort] = useState('recent');
  const [driveBrowserOpen, setDriveBrowserOpen] = useState(false);
  const [driveBrowserFiles, setDriveBrowserFiles] = useState([]);
  const [driveBrowserNextPage, setDriveBrowserNextPage] = useState('');
  const [driveBrowserLoaded, setDriveBrowserLoaded] = useState(false);
  const [driveBrowserLoading, setDriveBrowserLoading] = useState(false);
  const [driveBrowserError, setDriveBrowserError] = useState(null);
  const [linkingDriveFileId, setLinkingDriveFileId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => {
    const value = navigationContext?.eventDate || new URLSearchParams(window.location.search).get('agendaDate') || '';
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return calendarDateInTimeZone(new Date(), preferences.timezone);
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return toLocalDateInput(date) === value ? date : calendarDateInTimeZone(new Date(), preferences.timezone);
  });
  const [agendaView, setAgendaView] = useState(() => {
    const value = new URLSearchParams(window.location.search).get('agendaView');
    return ['Dia', 'Semana', 'Mês'].includes(value) ? value : 'Dia';
  });
  const [agendaQuery, setAgendaQuery] = useState('');
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState([]);
  const [calendarSyncBusy, setCalendarSyncBusy] = useState(false);
  const [calendarSyncError, setCalendarSyncError] = useState('');
  const [calendarSyncErrorCode, setCalendarSyncErrorCode] = useState('');
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
  const agendaCreateLockRef = useRef(null);
  if (!agendaCreateLockRef.current) agendaCreateLockRef.current = createAsyncActionLock();
  const [savingProject, setSavingProject] = useState(false);
  const projectCreateLockRef = useRef(false);
  const [savingTask, setSavingTask] = useState(false);
  const taskCreateLockRef = useRef(false);
  const uploadRef = useRef(null);
  const uploadCountRef = useRef(0);
  const fileUploadQueueRef = useRef(null);
  if (!fileUploadQueueRef.current) fileUploadQueueRef.current = createSequentialQueue();
  const [uploadingFiles, setUploadingFiles] = useState(false);
  useEffect(() => {
    if (key !== 'tarefas' || !navigationContext?.taskId || !tasksLoaded) return;
    const task = tasks.find((item) => String(item.id) === String(navigationContext.taskId));
    if (task) setSelectedTask(task);
    onNavigationContextConsumed();
  }, [key, navigationContext?.taskId, tasks, tasksLoaded, onNavigationContextConsumed]);
  useEffect(() => {
    const eventId = navigationContext?.eventId;
    const googleEventId = navigationContext?.googleEventId;
    if (key !== 'agenda' || (!eventId && !googleEventId) || !eventsLoaded) return;
    const linkedGoogleEvent = googleEventId && events.some((item) => String(item.googleEventId || '') === String(googleEventId));
    if (googleEventId && !linkedGoogleEvent && (calendarSyncBusy || (!calendarSyncedAt && !calendarSyncError))) return;
    const resolution = resolveAgendaNavigationEvent(events, eventId, eventsLoaded, {
      googleEventId,
      googleEvents: googleCalendarEvents,
      googleEventsLoaded: Boolean(calendarSyncedAt || calendarSyncError),
    });
    if (resolution.event) {
      const date = agendaNavigationEventDate(resolution.event);
      if (date) setSelectedDate(new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))));
      setSelectedEvent(resolution.event);
    }
    onNavigationContextConsumed();
  }, [key, navigationContext?.eventId, navigationContext?.googleEventId, events, eventsLoaded, googleCalendarEvents, calendarSyncBusy, calendarSyncedAt, calendarSyncError, onNavigationContextConsumed]);
  useEffect(() => {
    const action = navigationContext?.quickCreate;
    const target = { project: 'projetos', task: 'tarefas', event: 'agenda' }[action];
    const loaded = action === 'project' ? projectsLoaded : action === 'task' ? tasksLoaded : action === 'event' ? eventsLoaded : false;
    const collectionReady = action === 'project'
      ? canCreateWorkRecord('projetos', { projects: { loaded: projectsLoaded, error: projectsError } })
      : action === 'task'
        ? canCreateWorkRecord('tarefas', { tasks: { loaded: tasksLoaded, error: tasksError } })
        : action === 'event'
          ? canCreateWorkRecord('agenda', { events: { loaded: eventsLoaded, error: eventsError } })
          : false;
    if (!target || key !== target || !loaded || !collectionReady) return;
    if (action === 'project') setDraft({ title: '', client: '', clientId: '', project: '', due: '', assignee: '', type: 'Site institucional', templateId: 'blank', time: '16:30', detail: '', priority: 'Normal' });
    if (action === 'task') setDraft({ title: '', client: '', clientId: '', project: '', projectId: '', due: '', assignee: '', time: '16:30', detail: '', priority: 'Normal', recurrence: 'Nao recorrente' });
    if (action === 'event') setDraft({ title: '', client: '', project: '', due: toLocalDateInput(selectedDate), assignee: '', time: '16:30', endTime: '17:00', allDay: false, detail: '', priority: 'Normal', syncGoogleCalendar: !localDemo, createMeet: false, attendees: '', recurrence: 'none', recurrenceCount: 2 });
    setComposer(target);
    onNavigationContextConsumed();
  }, [key, navigationContext?.quickCreate, projectsLoaded, projectsError, tasksLoaded, tasksError, eventsLoaded, eventsError, selectedDate, localDemo, onNavigationContextConsumed]);
  useEffect(() => {
    if (key !== 'agenda') return undefined;
    if (localDemo) {
      setGoogleCalendarEvents([]);
      setCalendarSyncedAt('');
      setCalendarSyncError('');
      setCalendarSyncErrorCode('');
      setCalendarSyncBusy(false);
      return undefined;
    }
    let active = true;
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const end = new Date(start);
    if (agendaView === 'Semana') {
      const weekStart = startOfCalendarWeek(start, preferences.weekStart);
      start.setTime(weekStart.getTime());
      end.setTime(start.getTime()); end.setDate(start.getDate() + 6);
    } else if (agendaView === 'M\u00eas') {
      start.setDate(1); end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0);
    }
    const from = toLocalDateInput(start);
    const to = toLocalDateInput(end);
    setCalendarSyncBusy(true); setCalendarSyncError(''); setCalendarSyncErrorCode('');
    apiRequest(`/api/integrations/google/calendar/events?from=${from}&to=${to}&timeZone=${encodeURIComponent(preferences.timezone)}`)
      .then((result) => { if (!active) return; setGoogleCalendarEvents(result.data || []); setCalendarSyncedAt(new Intl.DateTimeFormat('pt-BR', { timeZone: preferences.timezone, hour: '2-digit', minute: '2-digit' }).format(new Date())); setCalendarSyncError(result.truncated ? 'A agenda contem mais eventos do que esta consulta exibiu. Reduza o periodo para ver todos.' : ''); setCalendarSyncErrorCode(''); })
      .catch((error) => { if (!active) return; setGoogleCalendarEvents([]); setCalendarSyncError(error.message || 'Nao foi possivel ler os eventos do Google Calendar.'); setCalendarSyncErrorCode(error.code || ''); })
      .finally(() => { if (active) setCalendarSyncBusy(false); });
    return () => { active = false; };
  }, [key, selectedDate, agendaView, calendarSyncRevision, localDemo, preferences.timezone, preferences.weekStart]);
  const [googleAccountEmail, setGoogleAccountEmail] = useState('');
  const [draft, setDraft] = useState({ title: '', client: '', clientId: '', project: '', projectId: '', due: '', assignee: '', time: '16:30', detail: '', priority: 'Normal', recurrence: 'Nao recorrente', syncGoogleCalendar: !localDemo, createMeet: false, attendees: '' });
  const [timerNow, setTimerNow] = useState(Date.now());
  useEffect(() => { if (localDemo) { setGoogleAccountEmail(''); return undefined; } let active = true; apiRequest('/api/integrations/status').then((result) => { if (active) setGoogleAccountEmail(result.data?.find((item) => item.provider === 'google')?.accountEmail || ''); }).catch(() => { if (active) setGoogleAccountEmail(''); }); return () => { active = false; }; }, [localDemo]);
  const activeTimer = hours.find((item) => item.status === 'running');
  const timerRunning = Boolean(activeTimer);
  const hoursTask = tasks.find((item) => String(item.id) === String(hoursTaskId) && !taskIsCompleted(item)) || null;
  const openHourEditor = (entry) => { setHourEditor(entry); setHourEditDraft({ taskId: String(entry.taskId || ''), hours: hoursEntryDurationInput(entry) }); };
  const saveHourEdit = async (event) => {
    event.preventDefault();
    const task = tasks.find((item) => String(item.id) === String(hourEditDraft.taskId));
    const duration = Number(String(hourEditDraft.hours).replace(',', '.'));
    if (!task || !Number.isFinite(duration) || duration <= 0) { notify('Escolha uma tarefa e informe uma duração maior que zero.'); return; }
    const project = findProjectForTask(task, projects);
    const result = await setHours((current) => current.map((item) => item.id === hourEditor.id ? { ...updateHoursEntryDuration(item, duration), taskId: task.id, title: task.title, project: project?.name || task.project || '', projectId: project?.id || task.projectId || '', client: task.client || project?.client || '', clientId: task.clientId || project?.clientId || '', assignee: task.assignee || item.assignee || '' } : item));
    if (result?.ok) { setHourEditor(null); notify('Registro de horas atualizado.'); }
    else notify(result?.error?.message || 'N\u00e3o foi poss\u00edvel atualizar o registro.');
  };
  const saveManualHours = async (event) => {
    event.preventDefault();
    const task = tasks.find((item) => String(item.id) === String(hourManualDraft.taskId));
    if (!task) { notify('Selecione a tarefa associada ao lançamento.'); return; }
    const interval = buildManualHoursInterval(hourManualDraft.date, hourManualDraft.start, hourManualDraft.end);
    if (interval.error) { notify(interval.error); return; }
    const { seconds } = interval;
    const project = findProjectForTask(task, projects);
    const record = {
      id: globalThis.crypto?.randomUUID?.() || `manual-hours-${Date.now()}`,
      title: task.title || 'Tarefa sem título', taskId: task.id,
      project: project?.name || task.project || '', projectId: project?.id || task.projectId || '',
      client: task.client || project?.client || '', clientId: task.clientId || project?.clientId || '',
      assignee: task.assignee || '', startedAt: interval.startedAt, endedAt: interval.endedAt,
      seconds, hours: Number((seconds / 3600).toFixed(2)), status: 'completed', source: 'manual',
    };
    const saved = await setHours((current) => [record, ...current]);
    if (!saved?.ok) { notify(saved?.error?.message || 'Não foi possível salvar o lançamento manual.'); return; }
    setHourComposerOpen(false);
    setHourManualDraft((current) => ({ ...current, taskId: '' }));
    notify('Lançamento manual salvo no workspace.');
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
  const toggleTimer = async () => {
    if (timerBusy || timerActionLockRef.current.locked) return;
    return timerActionLockRef.current.run(async () => {
      setTimerBusy(true);
      try {
        const now = new Date();
        if (!activeTimer) {
          const taskForTimer = key === 'horas' ? hoursTask : selectedTask;
          if (key === 'horas' && !taskForTimer) { notify('Selecione uma tarefa ativa antes de iniciar o cronômetro.'); return; }
          const id = globalThis.crypto?.randomUUID?.() || `timer-${Date.now()}`;
          const project = findProjectForTask(taskForTimer, projects);
          const saved = await setHours((current) => [...current.filter((item) => item.status !== 'running'), { id, title: taskForTimer?.title || 'Tempo sem tarefa', taskId: taskForTimer?.id || null, project: project?.name || taskForTimer?.project || '', projectId: project?.id || taskForTimer?.projectId || '', client: taskForTimer?.client || project?.client || '', clientId: taskForTimer?.clientId || project?.clientId || '', assignee: taskForTimer?.assignee || '', startedAt: now.toISOString(), status: 'running' }]);
          if (!saved?.ok) { notify(saved?.error?.message || 'Could not start timer.'); return; }
          notify('Cronômetro iniciado e sincronizado com o workspace.');
          return;
        }
        const elapsed = Math.max(0, Math.floor((now.getTime() - new Date(activeTimer.startedAt).getTime()) / 1000));
        const saved = await setHours((current) => current.map((item) => item.id === activeTimer.id ? { ...item, endedAt: now.toISOString(), seconds: elapsed, hours: Number((elapsed / 3600).toFixed(2)), status: 'completed' } : item));
        if (!saved?.ok) { notify(saved?.error?.message || 'Could not save elapsed time. The timer remains active.'); return; }
        notify('Tempo registrado no workspace.');
      } finally {
        setTimerBusy(false);
      }
    });
  };
  const timerLabel = `${String(Math.floor(timerSeconds / 3600)).padStart(2, '0')}:${String(Math.floor(timerSeconds % 3600 / 60)).padStart(2, '0')}:${String(timerSeconds % 60).padStart(2, '0')}`;
  const notify = (message) => {
    setToast(message);
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => setToast(''), 2600);
  };
  const addProject = () => {
    setDraft({ title: '', client: '', clientId: '', project: '', due: '', assignee: '', type: 'Site institucional', templateId: 'blank', time: '16:30', detail: '', priority: 'Normal' }); setComposer('projetos');
  };
  const visibleProjects = useMemo(() => projects.filter((item) => (projectStatus === 'Todos' ? !projectIsArchived(item) : item.status === projectStatus) && `${item.name} ${item.client} ${item.type}`.toLocaleLowerCase('pt-BR').includes(projectQuery.toLocaleLowerCase('pt-BR'))), [projects, projectStatus, projectQuery]);
  const projectEmpty = projects.length === 0
    ? { title: 'Nenhum projeto cadastrado', text: 'Crie seu primeiro projeto para acompanhar etapas, prazos e entregas.' }
    : projectQuery
      ? { title: 'Nenhum projeto encontrado', text: 'Revise o termo de busca ou limpe o campo para ver todos os projetos.' }
      : { title: 'Nenhum projeto nesta etapa', text: 'Escolha outro status para ver seus projetos.' };
  const visibleTasks = useMemo(() => tasks.filter((item) => (taskStatus === 'Todas' ? (preferences.showCompleted || !taskIsCompleted(item)) : taskMatchesStatus(item, taskStatus)) && [item.title, item.project, item.client].join(' ').toLocaleLowerCase('pt-BR').includes(taskQuery.toLocaleLowerCase('pt-BR'))), [tasks, taskStatus, taskQuery, preferences.showCompleted]);
  const visibleFiles = useMemo(() => {
    const normalizedQuery = safeLowercase(fileQuery);
    const filtered = files.filter((item) => matchesWorkspaceFileFilter(item, fileType) && safeLowercase(`${item.name || ''} ${item.project || ''} ${item.client || ''}`).includes(normalizedQuery));
    return fileSort === 'recent' ? sortFilesByRecent(filtered) : sortFilesByName(filtered);
  }, [files, fileType, fileQuery, fileSort]);
  const visibleDriveBrowserFiles = useMemo(() => driveBrowserFiles.filter((item) => matchesWorkspaceFileFilter({ name: item.name, mimeType: item.mimeType, folder: item.mimeType === 'application/vnd.google-apps.folder' }, fileType) && `${item.name || ''}`.toLocaleLowerCase('pt-BR').includes(fileQuery.toLocaleLowerCase('pt-BR'))), [driveBrowserFiles, fileType, fileQuery]);
  const selectedFileScopeLink = resolveFileUploadScopeLink(fileRecordScope, fileUploadScopeTarget, projects);
  const fileUploadScopeOptions = fileUploadScopeRequired ? [
    ...workspaceClients.filter((item) => fileRecordScope.clientIds?.map(String).includes(String(item.id))).map((item) => ({ value: `client:${item.id}`, label: `Cliente · ${item.name || item.title || 'Sem nome'}` })),
    ...projects.filter((item) => fileRecordScope.projectIds?.map(String).includes(String(item.id))).map((item) => ({ value: `project:${item.id}`, label: `Projeto · ${item.name || item.title || 'Sem nome'}` })),
  ] : [];
  const [hoursFrom, hoursTo] = hoursDateRange(hoursPeriod, new Date(), preferences.timezone, preferences.weekStart);
  const completedHours = hours.filter((item) => {
    if (item.status !== 'completed') return false;
    return hoursEntryIsInDateRange(item, preferences.timezone, hoursFrom, hoursTo);
  });
  const visibleHours = completedHours.filter((item) => `${item.project || ''} ${item.client || ''} ${item.title || ''}`.toLocaleLowerCase('pt-BR').includes(hoursQuery.toLocaleLowerCase('pt-BR')));
  const visibleApprovals = approvals.filter((item) => matchesWorkSearch([item.title, item.project, item.client, item.reviewer, item.status], approvalQuery));
  const activeProjects = projects.filter((item) => item.status === 'Em andamento' && !projectIsArchived(item)).length;
  const waitingProjects = projects.filter((item) => item.status === 'Aguardando cliente').length;
  const doneProjects = projects.filter(projectIsCompleted).length;
  const openTasks = tasks.filter((item) => !taskIsCompleted(item)).length;
  const completedTasks = tasks.length - openTasks;
  const taskCompletion = tasks.length ? Math.round(completedTasks / tasks.length * 100) : 0;

  const toggleTask = async (id) => taskCompletionLocks.current.run(id, async () => {
    const task = tasks.find((item) => String(item.id) === String(id));
    if (task && !taskIsCompleted(task)) {
      const blocker = taskDependencyBlocker(tasks, task);
      if (blocker) { notify(taskDependencyBlockMessage(blocker)); return; }
    }
    const result = completeTaskOccurrence(tasks, id);
    if (!result.occurrence) {
      const saved = await setTasks(result.tasks);
      if (!saved.ok) notify(`Não foi possível atualizar a tarefa: ${saved.error?.message || 'erro na API.'}`);
      return;
    }
    const completionSaved = await setTasks(result.tasks);
    if (!completionSaved.ok) { notify(`N\u00e3o foi poss\u00edvel concluir a tarefa: ${completionSaved.error?.message || 'erro na API.'}`); return; }
    notify(`Tarefa concluída. Próxima ocorrência criada para ${new Date(`${result.occurrence.due}T12:00:00`).toLocaleDateString('pt-BR')}.`);
  });
  const saveTaskDetails = async (patch) => {
    const result = await saveTaskDetailsOnce({ locks: taskDetailSaveLocks.current, tasks, taskId: selectedTask.id, patch, save: setTasks });
    if (result?.ok) setSelectedTask((current) => current ? { ...current, ...patch } : current);
    return result;
  };
  const deleteTask = async (task) => {
    const dependents = tasksDependingOn(tasks, task.id);
    if (dependents.length) {
      const names = dependents.slice(0, 3).map((item) => item.title || 'Tarefa sem título').join(', ');
      const remainder = dependents.length > 3 ? ` e mais ${dependents.length - 3}` : '';
      notify(`Não é possível excluir esta tarefa: ${names}${remainder} depende${dependents.length === 1 ? '' : 'm'} dela. Edite essas tarefas e remova ou troque a dependência primeiro.`);
      return false;
    }
    if (preferences.confirmDelete && !window.confirm(`Excluir a tarefa “${task.title}”? Esta ação não pode ser desfeita.`)) return false;
    const result = await setTasks((current) => current.filter((item) => String(item.id) !== String(task.id)));
    if (!result.ok) { notify(result.error?.message || 'Não foi possível excluir a tarefa.'); return false; }
    setSelectedTask(null);
    notify('Tarefa excluída.');
    return true;
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
    setDraft({ title: '', client: '', project: '', due: toLocalDateInput(date), assignee: '', time, endTime, allDay: false, detail: '', priority: 'Normal', syncGoogleCalendar: !localDemo, createMeet: false, attendees: '', recurrence: 'none', recurrenceCount: 2 }); setComposer('agenda');
  };
  const saveAgendaEvent = async () => {
    const tempId = globalThis.crypto?.randomUUID?.() || `event-${Date.now()}`;
    const { attendees } = parseAgendaAttendees(draft.attendees);
    const recurrence = ['daily', 'weekly', 'monthly'].includes(draft.recurrence) ? draft.recurrence : 'none';
    const internalRecurrence = recurrence !== 'none';
    const shouldSyncGoogle = !localDemo && !internalRecurrence && (draft.syncGoogleCalendar || draft.createMeet);
    const eventRecord = { id: tempId, date: draft.due, endDate: draft.allDay ? nextCalendarDate(draft.due) : calendarEndDate(draft.due, draft.time, draft.endTime), time: draft.allDay ? '' : draft.time, end: draft.allDay ? '' : draft.endTime, allDay: Boolean(draft.allDay), title: draft.title.trim(), detail: draft.detail.trim() || draft.client || 'Agenda da equipe', people: attendees.join(', ') || draft.assignee, googleEventId: '', googleMeetUrl: '', calendarSyncStatus: localDemo ? 'demo_local' : shouldSyncGoogle ? 'pending' : internalRecurrence ? 'internal_only' : 'not_requested', recurrence, recurrenceCount: internalRecurrence ? Math.max(2, Math.min(52, Number(draft.recurrenceCount) || 2)) : 1, color: 'blue' };
    const seriesId = internalRecurrence ? globalThis.crypto?.randomUUID?.() || `event-series-${Date.now()}` : '';
    const eventRecords = buildAgendaRecurrenceSeries(eventRecord, { recurrence, count: eventRecord.recurrenceCount, seriesId, makeId: (sequence) => `${tempId}-${sequence + 1}` });
    setSavingAgenda(true);
    try {
      const saved = await setEvents((items) => [...items, ...eventRecords]);
      if (!saved.ok) { notify(`Não foi possível salvar o evento: ${saved.error?.message || 'erro na API.'}`); return; }
      const createdEvent = resolveCreatedWorkspaceRecord(saved, tempId);
      if (!createdEvent) { notify('O Focusshub não confirmou o evento salvo. Atualize a agenda antes de tentar novamente.'); return; }
      let googleEvent = null;
      let calendarError = '';
      if (shouldSyncGoogle) {
        try {
          const result = await apiRequest('/api/integrations/google/calendar/events', { method: 'POST', body: JSON.stringify({ eventId: globalThis.crypto?.randomUUID?.().replaceAll('-', ''), title: draft.title.trim(), description: draft.detail.trim() || draft.client || '', date: draft.due, endDate: draft.allDay ? nextCalendarDate(draft.due) : calendarEndDate(draft.due, draft.time, draft.endTime), timeZone: preferences.timezone, allDay: Boolean(draft.allDay), startTime: draft.allDay ? '00:00' : draft.time, endTime: draft.allDay ? '23:59' : draft.endTime, createMeet: Boolean(draft.createMeet), attendees }) });
          googleEvent = result.data;
        } catch (error) { calendarError = error.message || 'O Google Calendar não confirmou a sincronização.'; }
        const linkedEvent = { ...createdEvent, googleEventId: googleEvent?.eventId || '', googleMeetUrl: googleEvent?.meetUrl || '', calendarSyncStatus: googleEvent ? 'connected' : 'not_connected', calendarSyncError: calendarError };
        const linked = await setEvents((items) => items.map((item) => String(item.id) === String(createdEvent.id) ? linkedEvent : item));
        if (!linked.ok && googleEvent?.eventId) {
          try {
            await apiRequest('/api/integrations/google/calendar/events/' + encodeURIComponent(googleEvent.eventId), { method: 'DELETE' });
            googleEvent = null;
            calendarError = 'O Google Calendar foi desfeito porque o Focusshub não conseguiu registrar o vínculo. O compromisso foi salvo somente no Focusshub.';
          } catch {
            googleEvent = null;
            calendarError = 'O Google criou o evento, mas o Focusshub não conseguiu salvar o vínculo nem desfazer a criação. Confira o Google Calendar.';
          }
          const unsynced = { ...createdEvent, googleEventId: '', googleMeetUrl: '', calendarSyncStatus: 'not_connected', calendarSyncError: calendarError };
          const statusSaved = await setEvents((items) => items.map((item) => String(item.id) === String(createdEvent.id) ? unsynced : item));
          if (!statusSaved.ok) calendarError += ' O estado da sincronização não foi salvo no Focusshub.';
        }
      }
      setComposer('');
      notify(googleEvent ? (googleEvent.meetUrl ? 'Evento salvo e sincronizado; link do Meet criado.' : 'Evento salvo e sincronizado com Google Calendar.') : shouldSyncGoogle ? `Evento salvo no Focusshub, mas não sincronizado com o Google: ${calendarError || 'confira sua conexão Google Workspace.'}` : internalRecurrence ? `Série com ${eventRecords.length} compromissos salva internamente no Focusshub; esta série não sincroniza com o Google Calendar.` : localDemo ? 'Evento salvo só nesta demonstração local.' : 'Evento salvo na agenda do Focusshub.');
    } finally { setSavingAgenda(false); }
  };
  const saveProjectComposer = async () => {
    if (projectCreateLockRef.current) return false;
    projectCreateLockRef.current = true;
    setSavingProject(true);
    try {
      const client = workspaceClients.find((item) => String(item.id) === String(draft.clientId));
      const temporaryId = globalThis.crypto?.randomUUID?.() || `project-${Date.now()}`;
      const project = { id: temporaryId, name: draft.title.trim(), client: String(client?.name || client?.title || 'Sem cliente'), clientId: client?.id || '', type: draft.type || 'Projeto', status: 'Em andamento', progress: 0, due: draft.due || 'A definir', team: [draft.assignee].filter(Boolean), tone: 'lime' };
      const projectSave = await setProjects((items) => [project, ...items]);
      if (!projectSave.ok) { notify(`Não foi possível salvar o projeto: ${projectSave.error?.message || 'erro na API.'}`); return false; }
      const savedProject = resolveCreatedWorkspaceRecord(projectSave, temporaryId);
      if (!savedProject) { notify('Projeto criado, mas não foi possível confirmar o vínculo para as tarefas do modelo. Atualize a lista antes de continuar.'); return true; }
      const templateTasks = buildProjectTemplateTasks(draft.templateId, savedProject, (index) => `${temporaryId}-task-${index + 1}`);
      if (templateTasks.length) {
        const tasksSave = await setTasks((items) => [...templateTasks, ...items]);
        if (!tasksSave.ok) {
          setSelectedProject(savedProject);
          notify(`Projeto criado, mas as tarefas de “${projectTemplateChoices().find((item) => item.value === draft.templateId)?.label || 'modelo'}” não foram salvas. O projeto foi aberto para você adicionar as tarefas manualmente.`);
          return true;
        }
        notify(`Projeto criado com ${templateTasks.length} tarefas iniciais do modelo.`);
      } else notify('Projeto criado e salvo.');
      return true;
    } finally {
      projectCreateLockRef.current = false;
      setSavingProject(false);
    }
  };
  const saveTaskComposer = async () => {
    if (taskCreateLockRef.current) return false;
    taskCreateLockRef.current = true;
    setSavingTask(true);
    try {
      const project = projects.find((item) => String(item.id) === String(draft.projectId));
      const client = workspaceClients.find((item) => String(item.id) === String(draft.clientId)) || findProjectClient(project, workspaceClients);
      const task = buildTaskRecord({
        id: globalThis.crypto?.randomUUID?.() || `task-${Date.now()}`,
        title: draft.title,
        project: project?.name || draft.project,
        projectId: project?.id,
        client: String(client?.name || client?.title || project?.client || ''),
        clientId: client?.id || project?.clientId,
        due: draft.due,
        assignee: draft.assignee,
        priority: draft.priority,
        recurrence: draft.recurrence,
        description: draft.detail,
      });
      const saved = await setTasks((items) => [task, ...items]);
      if (!saved.ok) { notify(`Não foi possível salvar a tarefa: ${saved.error?.message || 'erro na API.'}`); return false; }
      notify('Tarefa criada e salva.');
      return true;
    } finally {
      taskCreateLockRef.current = false;
      setSavingTask(false);
    }
  };
  const saveComposer = async (event) => {
    event.preventDefault(); if (!draft.title.trim()) return;
    if (composer === 'projetos') { if (savingProject) return; if (await saveProjectComposer()) setComposer(''); return; }
    if (composer === 'tarefas') { if (savingTask) return; if (await saveTaskComposer()) setComposer(''); return; }
    if (composer === 'agenda') {
      if (savingAgenda || agendaCreateLockRef.current.locked) return;
      const attendeeError = validateAgendaAttendees(draft.attendees);
      if (attendeeError) { notify(attendeeError); return; }
      const validationError = validateAgendaEvent({ date: draft.due, time: draft.time, end: draft.endTime, allDay: draft.allDay });
      if (validationError) { notify(validationError); return; }
      await agendaCreateLockRef.current.run(saveAgendaEvent); return;
    }
    const id = globalThis.crypto?.randomUUID?.() || `record-${Date.now()}`;
    if (composer === 'aprovacoes') {
      const client = workspaceClients.find((item) => String(item.id) === String(draft.clientId));
      const file = files.find((item) => String(item.id) === String(draft.fileId));
      if (!client || !approvalFileMatchesClient(file, client.id, projects, workspaceClients, localDemo)) { notify(localDemo ? 'Selecione um cliente e um arquivo da demonstração.' : 'Selecione um cliente e um arquivo enviado ao Google Drive.'); return; }
      if (localDemo) {
        const record = { id, title: draft.title.trim(), project: draft.project.trim() || 'Sem projeto', projectId: draft.projectId || '', client: String(client.name || client.title || 'Cliente'), clientId: client.id, kind: approvalFileKind(file), sent: new Date().toISOString(), reviewer: String(client.contactName || client.name || 'Cliente'), initials: String(client.name || client.title || 'C').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), status: 'Aguardando', attachment: { name: file.name, mimeType: file.mimeType || '', localOnly: true } };
        const saved = await setApprovals((items) => [record, ...items]);
        if (!saved.ok) { notify(`Não foi possível salvar a solicitação: ${saved.error?.message || 'erro na API.'}`); return; }
        notify('Solicitação salva somente na demonstração local; nenhum arquivo foi compartilhado.');
        setComposer('');
        return;
      }
      if (!window.confirm(`O Google Drive vai permitir que qualquer pessoa com o link veja “${file.name}”. Continuar para anexar este material à aprovação?`)) return;
      try {
        const shared = await apiRequest(`/api/integrations/google/drive/${encodeURIComponent(file.driveFileId)}/share-for-portal`, { method: 'POST', body: JSON.stringify({ confirmPublicAccess: true, clientId: client.id, ...(draft.projectId ? { projectId: draft.projectId } : {}) }) });
        const record = { id, title: draft.title.trim(), project: draft.project.trim() || 'Sem projeto', projectId: draft.projectId || '', client: String(client.name || client.title || 'Cliente'), clientId: client.id, kind: approvalFileKind(file), sent: new Date().toISOString(), reviewer: String(client.contactName || client.name || 'Cliente'), initials: String(client.name || client.title || 'C').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), status: 'Aguardando', attachment: { name: file.name, url: shared.data.url, mimeType: file.mimeType || '', driveFileId: file.driveFileId, permissionId: shared.data.permissionId || null, publicAccess: true } };
        const saved = await setApprovals((items) => [record, ...items]);
        const recovery = await recoverApprovalShareAfterSaveFailure({ saved, approval: record, shared: shared.data }, (permissionId) => apiRequest(`/api/integrations/google/drive/${encodeURIComponent(file.driveFileId)}/share-for-portal`, { method: 'DELETE', body: JSON.stringify({ permissionId }) }));
        if (!recovery.approvalSaved) {
          const detail = saved.error?.message || 'erro na API.';
          if (recovery.saveOutcomeUnknown) notify(`Não foi possível confirmar se a aprovação foi salva (${detail}). Atualize as aprovações antes de alterar o acesso público; se o registro não aparecer, remova “qualquer pessoa com o link” no Google Drive.`);
          else if (recovery.accessMayRemain) notify(`A aprovação não foi salva (${detail}). O arquivo ainda pode estar público; remova o acesso “qualquer pessoa com o link” nas permissões do Google Drive.`);
          else if (recovery.accessRevoked) notify(`A aprovação não foi salva (${detail}). O acesso público criado nesta tentativa foi revogado.`);
          else notify(`Não foi possível salvar a aprovação: ${detail}`);
          return;
        }
        notify(saved.ok ? 'Aprovação vinculada ao cliente e ao arquivo; o material pode ser revogado no Google Drive.' : 'Aprovação salva e confirmada no workspace após uma falha temporária de conexão.');
      } catch (error) { notify(error.message || 'Não foi possível compartilhar o arquivo para o portal.'); return; }
    }
    else { const saved = await setFiles((items) => [{ id, name: draft.title.trim(), project: draft.project || 'Sem projeto', client: draft.client || 'Sem cliente', date: 'Agora', size: '—', type: 'pdf', folder: false, localOnly: localDemo }, ...items]); if (!saved.ok) { notify(`Não foi possível registrar o arquivo: ${saved.error?.message || 'erro na API.'}`); return; } notify('Registro de arquivo salvo.'); }
    setComposer('');
  };
  const addLocalFile = async (file) => {
    if (!file) return;
    if (!file.size || file.size > 8 * 1024 * 1024) { notify('O arquivo precisa ter ate 8 MiB.'); return; }
    if (!localDemo && fileUploadScopeRequired && !selectedFileScopeLink) { notify('Selecione um cliente ou projeto do seu escopo antes de enviar o arquivo.'); return; }
    if (localDemo) {
      const record = { id: globalThis.crypto?.randomUUID?.() || `demo-file-${Date.now()}`, name: file.name, project: '', client: '', date: new Date().toLocaleDateString('pt-BR'), size: `${(file.size / 1024 / 1024).toFixed(2)} MB`, type: classifyWorkspaceFile({ name: file.name, mimeType: file.type }), folder: false, mimeType: file.type || 'application/octet-stream', localOnly: true };
      const saved = await setFiles((items) => [record, ...items]);
      notify(saved.ok ? 'Registro adicionado à demonstração local. O conteúdo não foi enviado.' : saved.error?.message || 'Não foi possível salvar o registro local.');
      return;
    }
    uploadCountRef.current += 1; setUploadingFiles(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Nao foi possivel ler o arquivo.')); reader.onload = () => resolve(String(reader.result || '')); reader.readAsDataURL(file); });
      const uploaded = await apiRequest('/api/integrations/google/drive/upload', { method: 'POST', body: JSON.stringify({ name: file.name, mimeType: file.type || 'application/octet-stream', data: dataUrl.slice(dataUrl.indexOf(',') + 1) }) });
      const result = uploaded.data;
      const scopeProject = selectedFileScopeLink?.projectId ? projects.find((item) => String(item.id) === String(selectedFileScopeLink.projectId)) : null;
      const scopeClient = selectedFileScopeLink?.clientId ? workspaceClients.find((item) => String(item.id) === String(selectedFileScopeLink.clientId)) : null;
      const saved = await setFiles((items) => [{ id: result.id, name: result.name, project: scopeProject?.name || '', client: String(scopeClient?.name || scopeClient?.title || ''), date: new Date(result.createdAt).toLocaleDateString('pt-BR'), size: `${(result.size / 1024 / 1024).toFixed(2)} MB`, type: classifyWorkspaceFile({ name: result.name, mimeType: result.mimeType || file.type }), folder: false, url: result.url, driveFileId: result.id, mimeType: result.mimeType, ...selectedFileScopeLink }, ...items]);
      notify(saved.ok ? `Arquivo enviado ao Google Drive: ${result.name}` : `Arquivo enviado ao Google Drive, mas não entrou na lista: ${saved.error?.message || 'sincronização pendente.'}`);
    } catch (error) { notify(error.message || 'O envio ao Google Drive falhou. Verifique a conexao em Integracoes.'); }
    finally { uploadCountRef.current = Math.max(0, uploadCountRef.current - 1); setUploadingFiles(uploadCountRef.current > 0); if (uploadRef.current) uploadRef.current.value = ''; }
  };
  const enqueueLocalFiles = (selectedFiles) => {
    const pending = Array.from(selectedFiles || []);
    if (!pending.length) return;
    fileUploadQueueRef.current.enqueue(async () => {
      for (const file of pending) {
        try { await addLocalFile(file); }
        catch (error) { notify(error.message || `Não foi possível enviar ${file.name}.`); }
      }
    });
  };
  const loadDriveBrowserPage = async ({ append = false, pageToken = '' } = {}) => {
    if (driveBrowserLoading || localDemo) return;
    setDriveBrowserLoading(true);
    setDriveBrowserError(null);
    try {
      const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
      const result = await apiRequest(`/api/integrations/google/drive/files${query}`);
      const data = result.data || {};
      const nextFiles = Array.isArray(data.files) ? data.files : [];
      setDriveBrowserFiles((current) => {
        const combined = append ? [...current, ...nextFiles] : nextFiles;
        return [...new Map(combined.map((file) => [String(file.id), file])).values()];
      });
      setDriveBrowserNextPage(data.nextPageToken || '');
      setDriveBrowserLoaded(true);
    } catch (error) {
      setDriveBrowserError(error);
      setDriveBrowserLoaded(true);
    } finally { setDriveBrowserLoading(false); }
  };
  const openDriveBrowser = () => {
    const nextOpen = !driveBrowserOpen;
    setDriveBrowserOpen(nextOpen);
    if (nextOpen && !driveBrowserLoaded) loadDriveBrowserPage();
  };
  const linkDriveFileToWorkspace = async (driveFile) => {
    if (!driveFile?.id || linkingDriveFileId) return;
    if (fileUploadScopeRequired && !selectedFileScopeLink) { notify('Selecione um cliente ou projeto do seu escopo antes de vincular o arquivo.'); return; }
    if (files.some((file) => String(file.driveFileId) === String(driveFile.id))) { notify('Este arquivo já está vinculado ao workspace.'); return; }
    const modifiedAt = driveFile.modifiedAt ? new Date(driveFile.modifiedAt) : null;
    const record = buildLinkedDriveFileRecord({
      file: driveFile,
      id: globalThis.crypto?.randomUUID?.() || `drive-file-${Date.now()}`,
      scopeLink: selectedFileScopeLink,
      clients: workspaceClients,
      projects,
      date: modifiedAt && !Number.isNaN(modifiedAt.getTime()) ? modifiedAt.toLocaleDateString('pt-BR') : '',
      size: formatDriveFileSize(driveFile.size),
      type: classifyWorkspaceFile({ name: driveFile.name, mimeType: driveFile.mimeType }),
    });
    if (record.error) { notify('O vínculo de cliente/projeto selecionado não existe mais. Atualize a tela e escolha outro.'); return; }
    setLinkingDriveFileId(String(driveFile.id));
    try {
      const saved = await setFiles((current) => current.some((file) => String(file.driveFileId) === String(driveFile.id)) ? current : [record, ...current]);
      if (!saved.ok) { notify(saved.error?.message || 'Não foi possível vincular o arquivo ao workspace.'); return; }
      notify('Arquivo vinculado ao workspace.');
    } finally { setLinkingDriveFileId(''); }
  };
  const decideApproval = async (id, status) => approvalActionLocks.current.run(id, async () => {
    const approval = approvals.find((item) => String(item.id) === String(id));
    if (!approval || !isApprovalAwaitingDecision(approval.status)) { notify('Esta solicitacao ja recebeu uma decisao. Atualize a tela antes de tentar novamente.'); return false; }
    const canonicalStatus = status === 'Aprovado' || status === 'Aprovada' ? 'Aprovada' : 'Alterações solicitadas';
    const saved = await setApprovals((current) => current.map((item) => String(item.id) === String(id) ? { ...item, status: canonicalStatus, decidedAt: new Date().toISOString() } : item));
    if (!saved.ok) { notify(`Não foi possível salvar a decisão: ${saved.error?.message || 'erro na API.'}`); return false; }
    notify(canonicalStatus === 'Aprovada' ? 'Material aprovado.' : 'Pedido de ajuste registrado.');
    return true;
  });
  const requestApprovalChanges = async (approval, text) => approvalActionLocks.current.run(approval?.id, async () => {
    if (!approval || String(text || '').trim().length < 3) return { ok: false };
    const current = approvals.find((item) => String(item.id) === String(approval.id));
    if (!current || !isApprovalAwaitingDecision(current.status)) return { ok: false };
    const at = new Date().toISOString();
    const saved = await setApprovals((items) => items.map((item) => String(item.id) === String(approval.id) ? { ...item, status: 'Alterações solicitadas', decidedAt: at, comments: [{ id: Date.now(), text: String(text).trim(), at }, ...(current.comments || [])] } : item));
    notify(saved.ok ? 'Pedido de ajuste e comentario salvos juntos no historico.' : saved.error?.message || 'Nao foi possivel registrar o pedido de ajuste.');
    return saved;
  });
  const withdrawApproval = async (approval) => {
    if (!approval || !isApprovalPending(approval.status)) return false;
    const attachment = approval.attachment || {};
    if (attachment.permissionId && !attachment.driveFileId) { notify('A solicitação não pode ser retirada com segurança: falta o ID do arquivo compartilhado.'); return false; }
    const willRevokeShare = Boolean(!localDemo && attachment.driveFileId && attachment.permissionId);
    const shareWillRemain = Boolean(attachment.publicAccess || attachment.permissionId) && !willRevokeShare;
    const message = willRevokeShare
      ? `Retirar a solicitação "${approval.title}" e revogar o acesso ao arquivo que foi compartilhado para ela? Outros links que usem essa permissão também deixarão de funcionar.`
      : `Retirar a solicitacao "${approval.title}"? O historico sera preservado. ${shareWillRemain ? (localDemo ? "O modo de demonstracao nao altera o compartilhamento externo." : "O acesso preexistente ao arquivo continuara ativo no Google Drive.") : ""}`;
    if (!window.confirm(message)) return false;
    if (willRevokeShare) {
      try { await apiRequest(`/api/integrations/google/drive/${encodeURIComponent(attachment.driveFileId)}/share-for-portal`, { method: 'DELETE', body: JSON.stringify({ permissionId: attachment.permissionId }) }); }
      catch (error) { notify(error.message || 'Não foi possível revogar o compartilhamento; a solicitação continua ativa.'); return false; }
    }
    const saved = await setApprovals((items) => items.map((item) => String(item.id) === String(approval.id) ? {
      ...item, status: 'Retirada', withdrawnAt: new Date().toISOString(),
      ...(willRevokeShare ? { attachment: { ...item.attachment, publicAccess: false, permissionId: null, url: '' } } : {}),
    } : item));
    if (!saved.ok) { notify(willRevokeShare ? 'Acesso revogado, mas a retirada não foi salva. Atualize a tela e tente novamente.' : saved.error?.message || 'Não foi possível retirar esta solicitação.'); return false; }
    notify(willRevokeShare ? 'Solicitacao retirada e acesso ao arquivo revogado.' : shareWillRemain ? (localDemo ? 'Solicitacao retirada; o compartilhamento externo nao foi alterado no modo de demonstracao.' : 'Solicitacao retirada; o acesso preexistente continua ativo no Google Drive.') : 'Solicitacao retirada. O historico foi preservado.');
    return true;
  };
  const revokeApprovalShare = async (approval) => {
    const attachment = approval?.attachment;
    if (localDemo) { notify('Modo de demonstracao: nenhum compartilhamento externo foi alterado.'); return; }
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
    if (isMember && Object.hasOwn(patch, 'status') && projectIsArchived(project) !== projectIsArchived({ ...project, ...patch })) { notify('Somente um administrador pode arquivar ou reabrir projetos.'); return false; }
    const updated = { ...project, ...patch };
    const result = await setProjects((current) => current.map((item) => item.id === project.id ? updated : item));
    if (result?.ok) { setSelectedProject(updated); return true; }
    notify(result?.error?.message || 'N\u00e3o foi poss\u00edvel salvar os detalhes do projeto.');
    return false;
  };
  const moveProject = async (id, status) => {
    const project = projects.find((item) => String(item.id) === String(id));
    if (!project || project.status === status) return;
    if (isMember && projectIsArchived(project) !== projectIsArchived({ ...project, status })) { notify('Somente um administrador pode arquivar ou reabrir projetos.'); return; }
    if (status === 'Arquivado' && !window.confirm(`Arquivar "${project.name}"? O histórico será preservado e você poderá reabrir o projeto depois.`)) return;
    const patch = { status, archivedAt: status === 'Arquivado' ? new Date().toISOString() : null };
    const saved = await setProjects((current) => current.map((item) => String(item.id) === String(id) ? { ...item, ...patch } : item));
    if (!saved?.ok) notify(saved?.error?.message || 'Não foi possível atualizar a etapa do projeto.');
    else notify('Etapa do projeto atualizada.');
  };

  const saveEventChanges = async (patch) => {
    const updated = { ...selectedEvent, ...patch, endDate: patch.allDay ? (selectedEvent.allDay && patch.date === selectedEvent.date ? selectedEvent.endDate : nextCalendarDate(patch.date)) : calendarEndDate(patch.date, patch.time, patch.end) };
    const validationError = validateAgendaEvent({ date: updated.date, time: updated.time, end: updated.end, allDay: updated.allDay }); if (validationError) { notify(validationError); return; }
    const attendeeError = validateAgendaAttendees(updated.people); if (attendeeError) { notify(attendeeError); return; }
    const googleOnly = selectedEvent.calendarSource === 'google';
    if (!googleOnly) {
      const localSave = await setEvents((current) => current.map((item) => String(item.id) === String(selectedEvent.id) ? updated : item));
      if (!localSave.ok) { notify(`Nao foi possivel salvar o evento: ${localSave.error?.message || 'erro na API.'}`); return; }
    }
    if (!selectedEvent.googleEventId) { notify('Evento atualizado na agenda do Focusshub.'); setSelectedEvent(null); return; }
    try {
      const { attendees } = parseAgendaAttendees(updated.people);
      const endDate = updated.allDay ? (selectedEvent.allDay && updated.date === selectedEvent.date ? selectedEvent.endDate : nextCalendarDate(updated.date)) : calendarEndDate(updated.date, updated.time, updated.end);
      const result = await apiRequest('/api/integrations/google/calendar/events', { method: 'PATCH', body: JSON.stringify({ eventId: selectedEvent.googleEventId, title: updated.title, description: updated.detail, date: updated.date, endDate, timeZone: preferences.timezone, allDay: Boolean(updated.allDay), startTime: updated.time || '00:00', endTime: updated.end || '23:59', attendees, createMeet: Boolean(selectedEvent.googleMeetUrl) }) });
      const synced = { ...updated, googleMeetUrl: result.data?.meetUrl || updated.googleMeetUrl, calendarSyncStatus: 'connected', calendarSyncError: '' };
      if (googleOnly) setGoogleCalendarEvents((current) => current.map((item) => String(item.googleEventId) === String(selectedEvent.googleEventId) ? synced : item));
      else {
        const syncSave = await setEvents((current) => current.map((item) => String(item.id) === String(selectedEvent.id) ? synced : item));
        if (!syncSave.ok) { notify('Google Calendar foi atualizado, mas o estado da sincronizacao nao foi salvo no workspace.'); return; }
      }
      notify(googleOnly ? 'Evento atualizado no Google Calendar.' : 'Evento atualizado no Focusshub e no Google Calendar.');
    } catch (error) {
      if (googleOnly) { notify(error.message || 'O Google Calendar nao confirmou a alteracao.'); return; }
      const failed = { ...updated, calendarSyncStatus: 'not_connected', calendarSyncError: error.message || 'Falha ao atualizar o Google Calendar.' };
      const syncSave = await setEvents((current) => current.map((item) => String(item.id) === String(selectedEvent.id) ? failed : item));
      notify(syncSave.ok ? `Evento salvo no Focusshub, mas o Google Calendar nao confirmou: ${failed.calendarSyncError}` : 'Evento atualizado no Focusshub, porem houve falha ao registrar a sincronizacao.');
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
      if (!deleted.ok) { notify(`Nao foi possivel remover o evento do Focusshub: ${deleted.error?.message || 'erro na API.'}`); return; }
    }
    setSelectedEvent(null);
    notify(googleOnly ? 'Evento removido do Google Calendar.' : 'Evento removido da agenda.');
  };

  return <main className="work-screen">
    {key === 'projetos' && projectsError && <div className="work-data-error" role="alert"><span>Não foi possível carregar os projetos. {projectsError}</span><button type="button" onClick={refreshProjects}>Tentar novamente</button></div>}
    {key === 'projetos' && !projectsLoaded && <div className="work-load-state" role="status">Carregando projetos...</div>}
    <header className="work-heading">
      <div className="work-title-wrap"><span className="work-title-icon"><screen.icon size={19} /></span><div><h1>{screen.title}</h1><p>{screen.description}</p></div></div>
    <div className="work-heading-actions"><button className="work-button work-button-quiet" onClick={() => {
      const selectors = { projetos: '.project-search input', tarefas: '.inline-search input', arquivos: '.drive-search input', agenda: '.agenda-search input' };
      if (selectors[key]) document.querySelector(selectors[key])?.focus();
      else if (key === 'horas') { setHoursSearchOpen(true); window.requestAnimationFrame(() => document.querySelector('.hours-search input')?.focus()); }
      else if (key === 'aprovacoes') { setApprovalSearchOpen(true); window.requestAnimationFrame(() => document.querySelector('.approval-search input')?.focus()); }
    }}><Search size={16} /><span>Buscar</span></button>{key !== 'horas' && !(isMember && key === 'projetos') && <button className="work-button work-button-primary" disabled={!canCreateWorkRecord(key, { events: { loaded: eventsLoaded, error: eventsError }, tasks: { loaded: tasksLoaded, error: tasksError }, projects: { loaded: projectsLoaded, error: projectsError }, files: { loaded: filesLoaded, error: filesError }, approvals: { loaded: approvalsLoaded, error: approvalsError } })} onClick={key === 'agenda' ? () => addEvent() : key === 'projetos' ? addProject : key === 'tarefas' ? addTask : key === 'arquivos' ? () => uploadRef.current?.click() : addApproval}><Plus size={16} />{key === 'agenda' ? 'Novo evento' : key === 'projetos' ? 'Novo projeto' : key === 'tarefas' ? 'Nova tarefa' : key === 'arquivos' ? 'Enviar arquivo' : 'Nova solicitação'}</button>}</div>
    </header>

    {key === 'projetos' && <>
      <section className="work-metrics"><Metric label="Em andamento" value={activeProjects} note={countText(projects.length, 'projeto cadastrado', 'projetos cadastrados')} icon={Activity} tone="lime" /><Metric label="Aguardando cliente" value={waitingProjects} note={`${countText(approvals.filter((item) => isApprovalPending(item.status)).length, 'aprovação pendente', 'aprovações pendentes')}`} icon={Clock3} tone="blue" /><Metric label="Concluídos" value={doneProjects} note="projetos finalizados" icon={CheckCircle2} tone="green" /></section>
      <div className="work-toolbar project-toolbar"><label className="inline-search project-search"><Search size={15} /><input value={projectQuery} onChange={(event) => setProjectQuery(event.target.value)} placeholder="Buscar projeto, cliente ou serviço" /></label><div className="work-tabs">{['Todos', 'Em andamento', 'Aguardando cliente', 'Concluído', 'Arquivado'].map((status) => <button key={status} className={projectStatus === status ? 'active' : ''} onClick={() => setProjectStatus(status)}>{status}<span>{status === 'Todos' ? projects.filter((project) => !projectIsArchived(project)).length : projects.filter((p) => p.status === status).length}</span></button>)}</div><div className="work-view-toggle project-view-toggle">{[['grid', LayoutGrid, 'Cartões'], ['list', List, 'Lista'], ['kanban', FolderKanbanIcon, 'Kanban'], ['calendar', CalendarDays, 'Calendário'], ['timeline', Clock3, 'Timeline']].map(([id, Icon, label]) => <button key={id} title={label} aria-label={`Visualização ${label}`} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon size={16} /></button>)}</div></div>
      {view === 'kanban' ? (projects.length === 0 ? projectsLoaded && !projectsError && <Empty title={projectEmpty.title} text={projectEmpty.text} /> : <div className="project-kanban">{['A fazer', 'Em andamento', 'Aguardando cliente', 'Concluído', 'Arquivado'].map((status) => <section className="project-kanban-column" key={status} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedProject) moveProject(draggedProject, status); setDraggedProject(null); }}><header><b>{status}</b><span>{visibleProjects.filter((item) => item.status === status).length}</span></header>{visibleProjects.filter((item) => item.status === status).map((project) => <div key={project.id} draggable onDragStart={() => setDraggedProject(project.id)} onDragEnd={() => setDraggedProject(null)}><ProjectCard project={project} onOpen={() => setSelectedProject(project)} /></div>)}{!visibleProjects.some((item) => item.status === status) && <p className="project-kanban-empty">Solte projetos nesta etapa</p>}</section>)}</div>) : view === 'timeline' ? <div className="project-timeline">{visibleProjects.map((project, index) => <article key={project.id} className="project-timeline-row"><div className="project-timeline-label"><span className={`project-timeline-dot ${project.tone}`} /><button onClick={() => setSelectedProject(project)}><b>{project.name}</b><small>{project.client} · {project.due}</small></button></div><div className="project-timeline-track"><i style={{ left: `${Math.min(65, index * 12)}%`, width: `${Math.max(18, project.progress || 10)}%` }} /><span>{project.progress}%</span></div><StatusPill status={project.status} /></article>)}{visibleProjects.length === 0 && projectsLoaded && !projectsError && <Empty title={projectEmpty.title} text={projectEmpty.text} />}</div> : view === 'calendar' ? <div className="project-calendar"><header><CalendarDays size={16}/><b>Entregas e prazos</b><small>Datas informadas nos projetos</small></header>{visibleProjects.map((project) => <button className="project-calendar-row" key={project.id} onClick={() => setSelectedProject(project)}><span>{project.due || 'Sem prazo'}</span><b>{project.name}</b><small>{project.client}</small><StatusPill status={project.status}/></button>)}{!visibleProjects.length&&projectsLoaded&&!projectsError&&<Empty title={projectEmpty.title} text={projectEmpty.text}/>}</div> : <div className={`project-grid ${view === 'list' ? 'project-list' : ''}`}>{visibleProjects.map((project) => <ProjectCard key={project.id} project={project} onOpen={() => setSelectedProject(project)} />)}{visibleProjects.length === 0 && projectsLoaded && !projectsError && <Empty title={projectEmpty.title} text={projectEmpty.text} />}</div>}
    </>}

    {key === 'tarefas' && <>
      {tasksError && <div className="work-data-error" role="alert"><span>{tasksError}</span><button type="button" onClick={refreshTasks}>Tentar novamente</button></div>}
      {!tasksLoaded && <div className="work-load-state" role="status">Carregando tarefas...</div>}
      {tasksLoaded && <section className="task-summary"><div><span className="summary-number">{openTasks}</span><span>tarefas abertas</span></div><div className="summary-track"><span style={{ width: `${taskCompletion}%` }} /></div><span className="summary-caption">{completedTasks} de {tasks.length} concluídas</span><div className="summary-people">{[...new Set(tasks.map((task) => task.assignee).filter(Boolean))].slice(0, 4).map((person) => <Avatar key={person} name={person} />)}</div></section>}
      <section className="work-panel"><div className="panel-toolbar"><div className="work-tabs">{['Todas', 'A fazer', 'Em andamento', 'Concluída'].map((status) => <button key={status} className={taskStatus === status ? 'active' : ''} onClick={() => setTaskStatus(status)}>{status}</button>)}</div><label className="inline-search"><Search size={15} /><input value={taskQuery} onChange={(e) => setTaskQuery(e.target.value)} placeholder="Buscar tarefa" /></label></div><div className="task-table"><div className="task-table-head"><span>Tarefa</span><span>Projeto</span><span>Responsável</span><span>Prazo</span><span>Status</span><span /></div>{visibleTasks.map((task) => { const priority = task.priority || 'Normal'; return <div className={`task-row ${taskIsCompleted(task) ? 'task-row-done' : ''}`} key={task.id}><button className="task-check" aria-label={taskIsCompleted(task) ? 'Reabrir tarefa' : 'Concluir tarefa'} onClick={() => toggleTask(task.id)}>{taskIsCompleted(task) ? <CheckCircle2 size={19} /> : <Circle size={19} />}</button><div className="task-main"><strong>{task.title}</strong><small>{task.client || 'Sem cliente'} <span className={`priority priority-${String(priority).toLowerCase()}`}>{priority}</span></small></div><span className="task-project">{task.project || 'Sem projeto'}</span><span className="task-owner"><Avatar name={task.assignee || 'Sem responsável'} /> {task.assignee || 'Sem responsável'}</span><span className="task-due"><Clock3 size={14} />{task.due || 'Sem prazo'}</span><StatusPill status={task.status} /><button className="row-more" aria-label="Mais opções" onClick={() => setSelectedTask(task)}><MoreHorizontal size={18} /></button></div>; })}{tasksLoaded && !tasksError && visibleTasks.length === 0 && <Empty title={tasks.length === 0 ? 'Nenhuma tarefa cadastrada' : 'Nada por aqui'} text={tasks.length === 0 ? 'Crie sua primeira tarefa para organizar o proximo passo.' : 'Tente outro filtro ou termo de busca.'} />}</div></section>
    </>}

    {key === 'agenda' && <>{!eventsLoaded ? <div className="work-load-state" role="status">Carregando agenda...</div> : eventsError ? <div className="work-data-error" role="alert"><span>{eventsError}</span><button type="button" onClick={refreshEvents}>Tentar novamente</button></div> : <AgendaCalendar events={[...events, ...googleCalendarEvents.filter((item) => !events.some((event) => event.googleEventId === item.googleEventId))]} selectedDate={selectedDate} setSelectedDate={setSelectedDate} agendaView={agendaView} setAgendaView={setAgendaView} agendaQuery={agendaQuery} setAgendaQuery={setAgendaQuery} calendarSyncBusy={calendarSyncBusy} calendarSyncError={calendarSyncError} calendarSyncErrorCode={calendarSyncErrorCode} calendarSyncedAt={calendarSyncedAt} localDemo={localDemo} timeZone={preferences.timezone} weekStartPreference={preferences.weekStart} locale="pt-BR" onSyncGoogleCalendar={() => setCalendarSyncRevision((revision) => revision + 1)} onSelectEvent={setSelectedEvent} onCreateEvent={addEvent} />}</>}
    {key === 'horas' && <>
      {hoursError && <div className="work-data-error" role="alert"><span>Não foi possível carregar os registros de horas. {hoursError}</span><button type="button" onClick={refreshHours}>Tentar novamente</button></div>}
      {!hoursLoaded && <div className="work-load-state" role="status">Carregando registros de horas...</div>}
      <section className="hours-overview"><div className="hours-total"><div><span className="eyebrow">CRONÔMETRO {timerRunning ? '· EM ANDAMENTO' : ''}</span><strong className="running-timer">{timerLabel}</strong><small>{timerRunning ? `Registrando tempo para ${activeTimer.title}` : 'Tempo desta sessão sincronizado com o workspace'}</small></div><span className="hours-ring" aria-hidden="true"><Timer size={22} /></span></div><div className="hours-stat"><span className="hours-stat-icon blue"><Timer size={17} /></span><div><small>Faturáveis nesta sessão</small><strong>{Math.floor(timerSeconds / 3600)}h {Math.floor(timerSeconds % 3600 / 60)}m</strong><em>Registro no workspace</em></div></div><div className="hours-stat"><span className="hours-stat-icon lime"><Activity size={17} /></span><div><small>Projetos ativos</small><strong>{countText(countActiveWorkProjects(projects), 'projeto', 'projetos')}</strong><em>em acompanhamento</em></div></div><label className="period-select"><span>Período</span><select value={safeLowercase(hoursPeriod) ? hoursPeriod : 'Esta semana'} onChange={(e) => setHoursPeriod(e.target.value)}><option>Esta semana</option><option>Semana passada</option><option>Este mês</option></select><ChevronDown size={14} /></label></section>
      <section className="work-panel hours-panel"><div className="panel-section-heading"><div><h2>Horas por projeto</h2><p>Registros concluídos · {hoursPeriod.toLowerCase()}</p></div><div className="hours-heading-actions">{hoursSearchOpen && <label className="inline-search hours-search"><Search size={15} /><input id="hours-search-input" type="search" aria-label="Buscar registros de horas" placeholder="Projeto, cliente ou tarefa" value={hoursQuery} onChange={(event) => setHoursQuery(event.target.value)} /></label>}<button className="work-button work-button-quiet" disabled={!hoursLoaded || Boolean(hoursError)} onClick={() => { setHourManualDraft((current) => ({ ...current, taskId: hoursTaskId || current.taskId })); setHourComposerOpen(true); }}><Plus size={15} /> Registrar horas</button><button className="work-button work-button-quiet" disabled={!hoursLoaded || Boolean(hoursError)} onClick={() => { const completed = visibleHours; const csv = rowsToCsv([['Projeto', 'Cliente', 'Tarefa', 'Horas', 'Inicio', 'Fim'], ...completed.map((item) => [item.project || '', item.client || '', item.title || '', item.hours || 0, item.startedAt || '', item.endedAt || ''])]); downloadCsvFile('horas-workspace.csv', csv); notify('Relatorio exportado com os registros do workspace.'); }}><Download size={15} /> Exportar</button></div></div><div className="hours-table"><div className="hours-table-head"><span>Projeto</span><span>Responsável</span><span>Horas</span><span>Progresso</span><span>Último registro</span><span aria-hidden="true" /></div>{visibleHours.map((row) => <div className="hours-row" key={row.id}><div className="hours-project"><span className="file-icon file-folder"><Folder size={16} /></span><span><b>{row.project || 'Sem projeto'}</b><small>{row.client || 'Sem cliente'} · {row.title}</small></span></div><span className="task-owner">{row.assignee || 'Workspace'}</span><strong>{Number(row.hours || 0).toFixed(2)}h</strong><div className="hours-bar"><i style={{ width: '100%' }} /><small>Registrado</small></div><span className="hours-last">{row.endedAt ? formatHoursEntryEnd(row.endedAt, preferences.timezone) : '—'}</span><div className="hours-row-actions"><button type="button" aria-label={`Editar registro de ${row.title}`} title="Editar registro" onClick={() => openHourEditor(row)}><MoreHorizontal size={16} /></button><button type="button" aria-label={`Excluir registro de ${row.title}`} title="Excluir registro" onClick={() => deleteHourRecord(row)}><X size={15} /></button></div></div>)}{hoursLoaded && !hoursError && visibleHours.length === 0 && <div className="work-empty-state" role="status">{hoursQuery ? 'Nenhum registro corresponde a esta busca.' : 'Nenhum tempo registrado ainda.'}{hoursQuery && <button type="button" onClick={() => setHoursQuery('')}>Limpar busca</button>}</div>}</div><label className="hours-task-picker" htmlFor="hours-task-select"><span>Vincular a uma tarefa</span><select id="hours-task-select" value={hoursTaskId} onChange={(event) => setHoursTaskId(event.target.value)} disabled={timerRunning || !tasks.some((item) => !taskIsCompleted(item))}><option value="">{tasks.some((item) => !taskIsCompleted(item)) ? 'Selecione uma tarefa ativa' : 'Cadastre uma tarefa para iniciar'}</option>{tasks.filter((item) => !taskIsCompleted(item)).map((item) => <option key={item.id} value={item.id}>{item.title}{item.project ? ` · ${item.project}` : ''}</option>)}</select><small>{timerRunning ? `Cronômetro vinculado a ${activeTimer.title}.` : 'O tempo será associado à tarefa selecionada.'}</small></label><button className={`start-timer ${timerRunning ? 'timer-active' : ''}`} onClick={toggleTimer} disabled={timerBusy || !hoursLoaded || Boolean(hoursError)}><span><Timer size={17} /></span><b>{timerRunning ? `Parar cronômetro · ${timerLabel}` : 'Iniciar cronômetro'}</b><small>{timerRunning ? activeTimer.title : hoursTask?.title || 'Selecione uma tarefa para vincular o tempo'}</small><ArrowRight size={16} /></button></section>
      {hourEditor && <div className="work-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHourEditor(null); }}><form className="work-compose-modal hours-edit-modal" role="dialog" aria-modal="true" aria-labelledby="hours-edit-title" onSubmit={saveHourEdit}><header><div><span className="eyebrow">HORAS &middot; AJUSTE</span><h2 id="hours-edit-title">Editar registro</h2></div><button type="button" aria-label="Fechar" onClick={() => setHourEditor(null)}><X size={18} /></button></header><label>Tarefa<select required value={hourEditDraft.taskId} onChange={(event) => setHourEditDraft((current) => ({ ...current, taskId: event.target.value }))}><option value="">Selecione uma tarefa</option>{tasks.map((item) => <option key={item.id} value={item.id}>{item.title}{item.project ? ` - ${item.project}` : ''}</option>)}</select></label><label>Dura&#231;&#227;o registrada (horas)<input required type="number" min="0.00028" step="any" inputMode="decimal" value={hourEditDraft.hours} onChange={(event) => setHourEditDraft((current) => ({ ...current, hours: event.target.value }))} /></label><p>O cliente e o projeto acompanham a tarefa selecionada. A duração mantém precisão de segundos.</p><footer><button type="button" className="work-button work-button-quiet" onClick={() => setHourEditor(null)}>Cancelar</button><button type="submit" className="work-button work-button-primary"><Check size={14} />Salvar ajustes</button></footer></form></div>}
      {hourComposerOpen && <div className="work-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setHourComposerOpen(false); }}><form className="work-compose-modal hours-edit-modal hours-manual-modal" role="dialog" aria-modal="true" aria-labelledby="hours-manual-title" onSubmit={saveManualHours}><header><div><span className="eyebrow">HORAS &middot; LAN&#199;AMENTO</span><h2 id="hours-manual-title">Registrar horas</h2></div><button type="button" aria-label="Fechar" onClick={() => setHourComposerOpen(false)}><X size={18} /></button></header><label>Tarefa associada<select required value={hourManualDraft.taskId} onChange={(event) => setHourManualDraft((current) => ({ ...current, taskId: event.target.value }))}><option value="">Selecione uma tarefa</option>{tasks.map((item) => <option key={item.id} value={item.id}>{item.title}{item.project ? <>{'\u00b7 '}{item.project}</> : ''}</option>)}</select></label><div className="hours-manual-fields"><label>Data<input required type="date" value={hourManualDraft.date} onChange={(event) => setHourManualDraft((current) => ({ ...current, date: event.target.value }))} /></label><label>In&#237;cio<input required type="time" value={hourManualDraft.start} onChange={(event) => setHourManualDraft((current) => ({ ...current, start: event.target.value }))} /></label><label>T&#233;rmino<input required type="time" value={hourManualDraft.end} onChange={(event) => setHourManualDraft((current) => ({ ...current, end: event.target.value }))} /></label></div><p>O total ser&#225; calculado pelo intervalo e vinculado ao projeto e cliente da tarefa. O lan&#231;amento s&#243; aparece ap&#243;s confirma&#231;&#227;o da API do workspace. Se o t&#233;rmino for anterior ao in&#237;cio, ser&#225; considerado no dia seguinte.</p><footer><button type="button" className="work-button work-button-quiet" onClick={() => setHourComposerOpen(false)}>Cancelar</button><button type="submit" className="work-button work-button-primary"><Check size={14} />Salvar lan&#231;amento</button></footer></form></div>}
    </>}

    {key === 'aprovacoes' && <>
      <section className="approval-summary"><div className="approval-count"><span className="approval-count-icon"><Clock3 size={18} /></span><div><strong>{approvals.filter((item) => isApprovalPending(item.status)).length}</strong><span>aguardando retorno</span></div></div><p>Aprovações ficam vinculadas ao cliente e exibem o arquivo compartilhado no portal.</p><button onClick={() => { window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Portal do cliente' })); notify('Selecione o cliente nesta tela e gere o link de acesso ao portal.'); }}><Send size={15} /> Abrir portal do cliente</button></section>
      {approvalSearchOpen && <div className="approval-search-row"><label className="inline-search approval-search"><Search size={15} /><input id="approval-search-input" type="search" aria-label="Buscar solicitações" placeholder="Cliente, projeto ou material" value={approvalQuery} onChange={(event) => setApprovalQuery(event.target.value)} /></label></div>}
      {approvalsError ? <div className="approval-load-error" role="alert"><strong>Não foi possível carregar as aprovações.</strong><span>{approvalsError}</span></div> : !approvalsLoaded ? <div className="approval-load-state" role="status">Carregando solicitações e histórico…</div> : visibleApprovals.length ? <div className="approval-list">{visibleApprovals.map((item) => { const kind = String(item.kind || 'Documento'); const reviewer = item.reviewer || 'sua equipe'; return <article className="approval-card" key={item.id}><div className={`approval-preview preview-${kind.toLowerCase()}`}><FileText size={24} /><span>{kind}</span><button type="button" aria-label="Visualizar material" onClick={() => setSelectedApproval(item)}><ArrowUpRight size={16} /></button></div><div className="approval-info"><div className="approval-title-line"><div><span className="approval-project">{item.project || 'Sem projeto'} <ChevronRight size={12} /> {item.client || 'Cliente'}</span><h3>{item.title || 'Material para aprovação'}</h3></div><StatusPill status={item.status} /></div><div className="approval-meta"><span>Enviado {item.sent || 'recentemente'}</span><span className="reviewer"><Avatar name={item.initials || reviewer} /> Aguardando {reviewer}</span></div><div className="approval-actions">{isApprovalAwaitingDecision(item.status) ? <><button type="button" className="work-button work-button-quiet" onClick={() => setSelectedApproval(item)}>Adicionar comentário</button><button type="button" className="work-button work-button-quiet" onClick={() => setSelectedApproval(item)}>Solicitar ajuste</button><button type="button" className="work-button work-button-approve" onClick={() => decideApproval(item.id, 'Aprovado')}><Check size={15} /> Aprovar</button></> : <button type="button" className="work-button work-button-quiet" onClick={() => setSelectedApproval(item)}>Ver histórico <ArrowRight size={14} /></button>}</div></div></article>; })}</div> : approvalQuery ? <Empty title="Nenhuma solicitação encontrada" text="Revise o termo ou limpe a busca para ver as solicitações." /> : <div className="approval-empty"><span><FileText size={19} /></span><strong>Nenhuma solicitação de aprovação</strong><p>Compartilhe um material com o cliente para acompanhar comentários e decisões nesta tela.</p><button type="button" className="work-button work-button-primary" onClick={addApproval}><Plus size={15} /> Nova solicitação</button></div>}
    </>}

    {key === 'arquivos' && <>
      <section className="drive-breadcrumb"><button onClick={() => setFileType('Todos')}>Arquivos</button><ChevronRight size={15} /><span>Todos os arquivos</span><span className="drive-space">{localDemo ? 'Demonstração local; nenhum arquivo vai para o Google Drive' : googleAccountEmail ? `Google Drive conectado: ${googleAccountEmail}` : 'Conecte o Google Drive em Integracoes para enviar arquivos'}</span></section>
      <section className="drive-tools"><label className="drive-search"><Search size={16} /><input placeholder="Buscar arquivos e pastas" value={fileQuery} onChange={(e) => setFileQuery(e.target.value)} /><kbd>⌘ K</kbd></label><div className="drive-filters"><SlidersHorizontal size={15} />{['Todos', 'Pastas', 'pdf', 'image', 'sheet', 'document'].map((type) => <button key={type} className={fileType === type ? 'active' : ''} onClick={() => setFileType(type)}>{type === 'image' ? 'Imagens' : type === 'sheet' ? 'Planilhas' : type === 'document' ? 'Documentos' : type === 'pdf' ? 'PDFs' : type}</button>)}</div>{!localDemo && <button type="button" className={`work-button ${driveBrowserOpen ? 'work-button-primary' : 'work-button-quiet'}`} aria-expanded={driveBrowserOpen} onClick={openDriveBrowser}><FolderOpen size={14} />{driveBrowserOpen ? 'Fechar Drive' : 'Navegar no Drive'}</button>}<button type="button" className="work-button work-button-quiet" aria-pressed={fileSort === 'recent'} onClick={() => setFileSort((current) => current === 'recent' ? 'name' : 'recent')}><ArrowDown size={14} /> {fileSort === 'recent' ? 'Recentes' : 'Nome A-Z'}</button></section>
      {driveBrowserOpen && <section className="drive-browser" aria-label="Arquivos acessíveis no Google Drive"><header><div><b>Google Drive · acessível ao Focusshub</b><small>O escopo conectado é <code>drive.file</code>: aparecem somente arquivos criados ou disponibilizados ao Focusshub. Acesso a todo o Drive não foi solicitado.</small></div><button type="button" className="work-button work-button-quiet" disabled={driveBrowserLoading} onClick={() => loadDriveBrowserPage()}><RefreshCw size={14} className={driveBrowserLoading ? 'drive-refresh-spin' : ''} />Atualizar</button></header>{driveBrowserError && <div className="drive-load-error" role="alert"><strong>{driveBrowserError.message || 'Não foi possível listar os arquivos do Google Drive.'}</strong>{driveBrowserError.code === 'google_drive_access_limited' && <span>Verifique se a Google Drive API está habilitada no projeto OAuth e se os arquivos foram criados ou disponibilizados ao Focusshub. Reautorizar não amplia esse acesso.</span>}<div className="drive-browser-error-actions"><button type="button" className="work-button work-button-quiet" onClick={() => loadDriveBrowserPage()} disabled={driveBrowserLoading}>Tentar novamente</button>{driveBrowserError.code === 'google_authorization_required' && <button type="button" className="work-button work-button-primary" onClick={() => window.location.assign('/api/integrations/google/authorize')}>Reautorizar Google</button>}{driveBrowserError.code === 'integration_disconnected' && <button type="button" className="work-button work-button-primary" onClick={() => window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Integrações' }))}>Abrir Integrações</button>}</div></div>}{driveBrowserLoading && !driveBrowserLoaded && <div className="drive-load-state" role="status">Carregando arquivos autorizados ao Focusshub...</div>}{driveBrowserLoaded && !driveBrowserError && <><div className="drive-browser-list">{visibleDriveBrowserFiles.map((file) => { const linked = files.some((item) => String(item.driveFileId) === String(file.id)); return <article className="drive-browser-row" key={file.id}><span className={`file-icon ${classifyWorkspaceFile({ name: file.name, mimeType: file.mimeType }) === 'folder' ? 'file-folder' : `file-${classifyWorkspaceFile({ name: file.name, mimeType: file.mimeType })}`} `}>{classifyWorkspaceFile({ name: file.name, mimeType: file.mimeType }) === 'folder' ? <Folder size={16} /> : <FileText size={16} />}</span><div><b>{file.name}</b><small>{file.mimeType || 'Arquivo'} · {file.modifiedAt ? new Date(file.modifiedAt).toLocaleDateString('pt-BR') : 'Data indisponível'}</small></div><a className="work-button work-button-quiet" href={file.url} target="_blank" rel="noopener noreferrer">Abrir no Drive <ArrowUpRight size={14} /></a><button type="button" className="work-button work-button-quiet" disabled={linked || (fileUploadScopeRequired && !selectedFileScopeLink) || linkingDriveFileId === String(file.id)} onClick={() => linkDriveFileToWorkspace(file)}>{linked ? 'Já vinculado' : linkingDriveFileId === String(file.id) ? 'Vinculando...' : 'Vincular ao workspace'}</button></article>; })}{!visibleDriveBrowserFiles.length && <div className="drive-browser-empty">{driveBrowserFiles.length ? 'Nenhum arquivo corresponde à busca ou ao filtro.' : driveBrowserNextPage ? 'Nenhum arquivo acessível nesta página. Carregue mais arquivos para continuar.' : 'Nenhum arquivo acessível ao Focusshub. O escopo atual não permite navegar por arquivos que não foram disponibilizados ao app.'}</div>}</div>{driveBrowserNextPage && <button type="button" className="work-button work-button-quiet drive-browser-more" disabled={driveBrowserLoading} onClick={() => loadDriveBrowserPage({ append: true, pageToken: driveBrowserNextPage })}>{driveBrowserLoading ? 'Carregando...' : 'Carregar mais arquivos'}</button>}</>}</section>}
      <div className="drive-section-heading"><h2>Acessados recentemente</h2><button onClick={() => setView(view === 'grid' ? 'list' : 'grid')}>{view === 'grid' ? <List size={16} /> : <LayoutGrid size={16} />} {view === 'grid' ? 'Lista' : 'Grade'}</button></div>
      {filesError ? <div className="drive-load-error" role="alert"><strong>Não foi possível carregar os arquivos.</strong><span>{filesError}</span><button type="button" className="work-button work-button-quiet" onClick={refreshFiles}>Tentar novamente</button></div> : !filesLoaded ? <div className="drive-load-state" role="status">Carregando arquivos do workspace…</div> : <section className={`drive-grid ${view === 'list' ? 'drive-list' : ''}`}>{visibleFiles.map((file) => <FileCard key={file.id} file={file} onOpen={() => shouldOpenFileDetailsByDefault(file) ? setSelectedFile(file) : window.open(file.url, '_blank', 'noopener,noreferrer')} onMenu={() => setSelectedFile(file)} />)}{visibleFiles.length === 0 && <Empty title="Nenhum arquivo encontrado" text="Mude os filtros ou tente outra busca." />}</section>}
      {fileUploadScopeRequired && <label className="drive-scope-picker"><span>Vincular envio a cliente ou projeto</span><select value={fileUploadScopeTarget} onChange={(event) => setFileUploadScopeTarget(event.target.value)}><option value="">{fileUploadScopeOptions.length ? 'Selecione um vínculo do seu escopo' : 'Nenhum vínculo disponível'}</option>{fileUploadScopeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><small>{fileUploadScopeOptions.length ? 'O vínculo é necessário para salvar o arquivo dentro dos registros que você pode acessar.' : 'Peça à pessoa proprietária do workspace para atribuir clientes ou projetos ao seu acesso.'}</small></label>}
      <div className="drive-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!uploadingFiles && filesLoaded && !filesError) enqueueLocalFiles(e.dataTransfer.files); }}><span><Upload size={18} /></span><div><b>Organize os arquivos do seu time</b><small>{localDemo ? 'Os registros desta demonstração não enviam o conteúdo do arquivo.' : googleAccountEmail ? 'O arquivo será enviado ao Google Drive conectado.' : 'Conecte o Google Drive em Integrações antes de enviar.'}</small></div><button type="button" disabled={uploadingFiles || !filesLoaded || Boolean(filesError) || (fileUploadScopeRequired && !selectedFileScopeLink)} onClick={() => uploadRef.current?.click()}>{uploadingFiles ? 'Enviando...' : 'Selecionar arquivo'}</button><input ref={uploadRef} type="file" hidden multiple disabled={uploadingFiles || !filesLoaded || Boolean(filesError) || (fileUploadScopeRequired && !selectedFileScopeLink)} onChange={(e) => { enqueueLocalFiles(e.target.files); e.target.value = ''; }} /></div>
    </>}

    {selectedTask && key === 'tarefas' && <TaskDetail localDemo={localDemo} task={selectedTask} tasks={tasks} onClose={() => setSelectedTask(null)} onDelete={() => deleteTask(selectedTask)} onSave={saveTaskDetails} onFileUploaded={async (file) => { const saved = await setFiles((current) => [{ id: globalThis.crypto?.randomUUID?.() || `drive-file-${Date.now()}`, name: file.name, project: selectedTask.project || '', client: selectedTask.client || '', taskId: selectedTask.id, size: `${(file.size / 1024 / 1024).toFixed(2)} MB`, type: classifyWorkspaceFile({ name: file.name, mimeType: file.mimeType }), folder: false, url: file.url, driveFileId: file.id, mimeType: file.mimeType, localOnly: Boolean(file.localOnly) }, ...current]); if (!saved.ok) notify(saved.error?.message || 'O anexo foi vinculado à tarefa, mas não entrou na lista de arquivos.'); return saved; }} onAction={notify} />}
    {selectedEvent && key === 'agenda' && <EventDetail event={selectedEvent} onClose={() => setSelectedEvent(null)} onSave={saveEventChanges} onDelete={deleteSelectedEvent} />}
    {selectedFile && key === 'arquivos' && <FileDetail key={selectedFile.id} file={selectedFile} clients={workspaceClients} projects={projects} onAction={notify} onClose={() => setSelectedFile(null)} onSave={async (patch) => { const updated = { ...patch, updatedAt: new Date().toISOString() }; if (!selectedFile.localOnly && selectedFile.driveFileId && String(updated.name || '').trim() !== String(selectedFile.name || '').trim()) { try { await apiRequest('/api/integrations/google/drive/' + encodeURIComponent(selectedFile.driveFileId) + '/metadata', { method: 'PATCH', body: JSON.stringify({ name: updated.name }) }); } catch (error) { notify(error.message || 'O Google Drive não confirmou a alteração do nome.'); return { ok: false, error }; } } const saved = await setFiles((current) => current.map((item) => item.id === selectedFile.id ? { ...item, ...updated } : item)); if (!saved.ok) { notify(saved.error?.message || 'Nao foi possivel salvar os metadados.'); return saved; } setSelectedFile((current) => ({ ...current, ...updated })); notify('Metadados do arquivo atualizados.'); return saved; }} onDelete={async () => { if (preferences.confirmDelete && !window.confirm('Remover este registro local?')) return false; const removed = await setFiles((current) => current.filter((item) => item.id !== selectedFile.id)); if (!removed.ok) { notify(removed.error?.message || 'Nao foi possivel remover o registro.'); return removed; } setSelectedFile(null); notify('Registro removido; o arquivo original nao foi alterado.'); return removed; }} />}
    {selectedApproval && key === 'aprovacoes' && <ApprovalDetail approval={approvals.find((item) => item.id === selectedApproval.id) || selectedApproval} onClose={() => setSelectedApproval(null)} onRevokeShare={revokeApprovalShare} onWithdraw={withdrawApproval} onRequestChanges={(text) => requestApprovalChanges(selectedApproval, text)} onOpenPortal={(approval) => { window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: { page: 'Portal do cliente', context: { clientId: approval.clientId } } })); }} onComment={async (text) => { const result = await setApprovals((current) => current.map((item) => String(item.id) === String(selectedApproval.id) ? { ...item, comments: [{ id: Date.now(), text, at: new Date().toISOString() }, ...(item.comments || [])] } : item)); notify(result.ok ? 'Comentario registrado no historico.' : result.error?.message || 'Nao foi possivel salvar o comentario.'); return result; }} onDecision={async (status) => { const saved = await decideApproval(selectedApproval.id, status); if (saved) setSelectedApproval(null); return saved; }} />}
    {selectedProject && key === 'projetos' && <ProjectDetail project={selectedProject} canArchive={!isMember} clients={workspaceClients} tasks={tasks.filter((task) => taskBelongsToProject(task, selectedProject, projects))} onClose={() => setSelectedProject(null)} onUpdate={(patch) => updateProject(selectedProject, patch)} onTaskToggle={toggleTask} onAddTask={(task) => setTasks((current) => [task, ...current])} onAction={notify} />}
    {composer && <div className="work-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setComposer(''); }}><form className="work-compose-modal" role="dialog" aria-modal="true" aria-labelledby="work-compose-title" aria-busy={(composer === 'agenda' && savingAgenda) || (composer === 'tarefas' && savingTask) || (composer === 'projetos' && savingProject)} onSubmit={saveComposer}><header><div><span className="eyebrow">FOCUSSHUB · {composer === 'aprovacoes' ? 'APROVAÇÕES' : composer.toUpperCase()}</span><h2 id="work-compose-title">{composer === 'projetos' ? 'Criar projeto' : composer === 'tarefas' ? 'Criar tarefa' : composer === 'agenda' ? 'Novo evento' : composer === 'aprovacoes' ? 'Solicitar aprovação' : 'Registrar arquivo'}</h2></div><button type="button" aria-label="Fechar" disabled={(composer === 'tarefas' && savingTask) || (composer === 'projetos' && savingProject) || (composer === 'agenda' && savingAgenda)} onClick={() => setComposer('')}><X size={18} /></button></header><label>{composer === 'arquivos' ? 'Nome do arquivo' : 'Título'}<input autoFocus required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={composer === 'projetos' ? 'Ex.: Site institucional' : composer === 'tarefas' ? 'Ex.: Revisar homepage' : composer === 'agenda' ? 'Ex.: Reunião de briefing' : composer === 'aprovacoes' ? 'Ex.: Homepage · versão 01' : 'Ex.: Briefing aprovado'} /></label>{composer === 'aprovacoes' ? <><label>Cliente<select required value={draft.clientId || ''} onChange={(e) => { const client = workspaceClients.find((item) => String(item.id) === e.target.value); setDraft({ ...draft, clientId: e.target.value, client: String(client?.name || client?.title || ''), projectId: '', project: '', fileId: '' }); }}><option value="">Selecione um cliente</option>{workspaceClients.map((item) => <option key={item.id} value={item.id}>{item.name || item.title || 'Cliente'}</option>)}</select></label><label>Projeto relacionado<select value={draft.projectId || ''} onChange={(e) => { const project = projects.find((item) => String(item.id) === e.target.value); setDraft({ ...draft, projectId: e.target.value, project: project?.name || '', fileId: '' }); }}><option value="">Sem projeto</option>{projects.filter((item) => { const linkedClient = findProjectClient(item, workspaceClients); return Boolean(draft.clientId && linkedClient && String(linkedClient.id) === String(draft.clientId)); }).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Arquivo compartilhado<select required value={draft.fileId || ''} onChange={(e) => setDraft({ ...draft, fileId: e.target.value })}><option value="">Selecione um arquivo do Google Drive</option>{files.filter((item) => approvalFileMatchesClient(item, draft.clientId, projects, workspaceClients, localDemo)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{files.filter((item) => approvalFileMatchesClient(item, draft.clientId, projects, workspaceClients, localDemo)).length === 0 && <div className="approval-drive-setup"><p className="work-modal-note">Associe um arquivo enviado ao Drive a este cliente ou projeto pela ficha do arquivo antes de compartilh&#225;-lo no portal.</p><button type="button" className="work-button work-button-quiet" onClick={() => { setComposer(''); window.dispatchEvent(new CustomEvent('nexo:navigate', { detail: 'Integra\u00e7\u00f5es' })); }}>Configurar Google Drive</button></div>}</> : <>{['projetos', 'tarefas'].includes(composer) && <label>Cliente<select value={draft.clientId || ''} onChange={(e) => { const client = workspaceClients.find((item) => String(item.id) === e.target.value); setDraft({ ...draft, clientId: e.target.value, client: String(client?.name || client?.title || ''), projectId: '', project: '' }); }}><option value="">Sem cliente vinculado</option>{workspaceClients.map((item) => <option key={item.id} value={item.id}>{item.name || item.title || 'Cliente'}</option>)}</select></label>}{composer === 'arquivos' && <label>Cliente<input value={draft.client} onChange={(e) => setDraft({ ...draft, client: e.target.value })} placeholder="Nome do cliente" /></label>}</>}{composer === 'tarefas' && <label>Projeto relacionado<select value={draft.projectId || ''} onChange={(e) => { const project = projects.find((item) => String(item.id) === e.target.value); const linkedClient = findProjectClient(project, workspaceClients); setDraft({ ...draft, projectId: e.target.value, project: project?.name || '', ...(!draft.clientId && linkedClient ? { clientId: linkedClient.id, client: String(linkedClient.name || linkedClient.title || '') } : {}) }); }}><option value="">Sem projeto vinculado</option>{projects.filter((item) => { const linkedClient = findProjectClient(item, workspaceClients); const unresolvedClient = Boolean(String(item.client || '').trim() && String(item.client).trim().toLocaleLowerCase('pt-BR') !== 'sem cliente' && !linkedClient); return !draft.clientId || (linkedClient ? String(linkedClient.id) === String(draft.clientId) : !item.clientId && !unresolvedClient); }).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}{composer === 'arquivos' && <label>Projeto<input value={draft.project} onChange={(e) => setDraft({ ...draft, project: e.target.value })} placeholder="Projeto relacionado" /></label>}{composer === 'tarefas' && <div className="work-compose-grid"><label>Prazo<input type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} /></label><label>Prioridade<select value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}><option>Baixa</option><option>Normal</option><option>Alta</option><option>Urgente</option></select></label><label>Recorrência<select value={draft.recurrence || 'Nao recorrente'} onChange={(e) => setDraft({ ...draft, recurrence: e.target.value })}><option value="Nao recorrente">N&#227;o recorrente</option><option value="Diaria">Di&#225;ria</option><option value="Semanal">Semanal</option><option value="Mensal">Mensal</option></select></label></div>}{composer === 'tarefas' && <label>Descrição<textarea rows={3} value={draft.detail || ''} onChange={(event) => setDraft({ ...draft, detail: event.target.value })} placeholder="Contexto, próximos passos ou critérios de conclusão" /></label>}{composer === 'projetos' && <div className="work-compose-grid"><label>Tipo<select value={draft.type || 'Site institucional'} onChange={(e) => setDraft({ ...draft, type: e.target.value })}><option>Site institucional</option><option>Identidade visual</option><option>Aplicativo web</option><option>Campanha</option><option>Outro</option></select></label><label>Modelo inicial<select value={draft.templateId || 'blank'} onChange={(e) => setDraft({ ...draft, templateId: e.target.value })}>{projectTemplateChoices().map((item) => <option key={item.value} value={item.value}>{item.label}{item.taskCount ? ` · ${item.taskCount} tarefas` : ''}</option>)}</select></label><label>Responsável<input value={draft.assignee || ''} onChange={(e) => setDraft({ ...draft, assignee: e.target.value })} placeholder="Nome da pessoa responsável" /></label></div>}{composer === 'projetos' && <label>Prazo<input type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} /></label>}{composer === 'agenda' && <><label className="work-sync-option"><input type="checkbox" checked={Boolean(draft.allDay)} onChange={(e) => setDraft({ ...draft, allDay: e.target.checked })} />Evento de dia inteiro</label><div className="work-compose-grid"><label>Data<input required type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} /></label>{!draft.allDay && <><label>Hor&#225;rio<input required type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} /></label><label>T&#233;rmino<input required type="time" value={draft.endTime} onChange={(e) => setDraft({ ...draft, endTime: e.target.value })} /></label></>}<label>Detalhes<input value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })} placeholder="Cliente ou contexto" /></label></div><div className="work-compose-grid"><label>Recorrência<select value={draft.recurrence || 'none'} onChange={(e) => setDraft({ ...draft, recurrence: e.target.value })}><option value="none">Não se repete</option><option value="daily">Diariamente</option><option value="weekly">Semanalmente</option><option value="monthly">Mensalmente</option></select></label>{draft.recurrence && draft.recurrence !== 'none' && <label>Ocorrências (2 a 52)<input type="number" min="2" max="52" step="1" value={draft.recurrenceCount || 2} onChange={(e) => setDraft({ ...draft, recurrenceCount: e.target.value })} /></label>}</div>{draft.recurrence && draft.recurrence !== 'none' && <p className="work-modal-note">A série será salva somente na Agenda do Focusshub e não será enviada ao Google Calendar.</p>}<label>Convidados &middot; e-mails separados por virgula<input type="text" value={draft.attendees} onChange={(e) => setDraft({ ...draft, attendees: e.target.value })} placeholder="nome@empresa.com.br" /></label>{!localDemo && (!draft.recurrence || draft.recurrence === 'none') && <><label className="work-sync-option"><input type="checkbox" checked={draft.syncGoogleCalendar} onChange={(e) => setDraft({ ...draft, syncGoogleCalendar: e.target.checked })} />Sincronizar com Google Calendar</label><label className="work-sync-option"><input type="checkbox" checked={draft.createMeet} onChange={(e) => setDraft({ ...draft, createMeet: e.target.checked })} />Criar link do Google Meet</label></>}</>}{['tarefas', 'aprovações'].includes(composer) && <label>Responsável<input value={draft.assignee} onChange={(e) => setDraft({ ...draft, assignee: e.target.value })} /></label>}<footer><button type="button" className="work-button work-button-quiet" onClick={() => setComposer('')} disabled={(composer === 'tarefas' && savingTask) || (composer === 'projetos' && savingProject) || (composer === 'agenda' && savingAgenda)}>Cancelar</button><button className="work-button work-button-primary" type="submit" disabled={(composer === 'agenda' && savingAgenda) || (composer === 'tarefas' && savingTask) || (composer === 'projetos' && savingProject)}><Check size={15} />{savingAgenda || savingTask || savingProject ? 'Salvando…' : composer === 'agenda' ? 'Salvar evento' : composer === 'projetos' ? 'Criar projeto' : 'Salvar'}</button></footer></form></div>}
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
function StatusPill({ status }) { const label = String(status || 'Pendente'); const slug = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s/g, '-'); return <span className={`status-pill status-${slug}`}><i />{label}</span>; }
function EventDetail({ event, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState({ title: event.title || '', date: event.date || new Date().toISOString().slice(0, 10), time: event.time || '09:00', end: event.end || '09:30', detail: event.detail || '', people: event.people || '', allDay: Boolean(event.allDay) });
  return <div className="work-modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><form className="work-compose-modal" role="dialog" aria-modal="true" aria-label={`Compromisso ${event.title}`} onSubmit={(e) => { e.preventDefault(); onSave(draft); }}><header><div><span className="eyebrow">AGENDA ? COMPROMISSO</span><h2>{event.title}</h2></div><button type="button" aria-label="Fechar" onClick={onClose}><X size={18}/></button></header><label>Titulo<input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })}/></label><div className="work-compose-grid"><label>Data<input required type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })}/></label><label className="work-sync-option"><input type="checkbox" checked={draft.allDay} onChange={(e) => setDraft({ ...draft, allDay: e.target.checked })}/>Evento de dia inteiro</label>{!draft.allDay && <><label>Inicio<input required type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })}/></label><label>Termino<input required type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })}/></label></>}<label>Participantes<input value={draft.people} onChange={(e) => setDraft({ ...draft, people: e.target.value })}/></label></div><label>Detalhes<input value={draft.detail} onChange={(e) => setDraft({ ...draft, detail: e.target.value })}/></label>{event.calendarSyncStatus === 'connected' ? <p className="work-modal-note">Evento sincronizado com Google Calendar.</p> : <p className="work-modal-note">{event.calendarSyncError || (event.calendarSyncStatus === 'pending' ? 'Sincronizacao com Google Calendar em andamento.' : event.calendarSyncStatus === 'not_connected' ? 'Evento salvo no Focusshub, mas sem sincronizacao com Google Calendar.' : 'Evento salvo na agenda do Focusshub.')}</p>}{event.googleMeetUrl && <a className="work-meet-link" href={event.googleMeetUrl} target="_blank" rel="noreferrer">Entrar no Google Meet</a>}{event.googleHtmlLink && <a className="work-meet-link" href={event.googleHtmlLink} target="_blank" rel="noreferrer">Abrir no Google Calendar</a>}<footer><button type="button" className="work-button work-button-quiet file-remove" onClick={onDelete}>Excluir evento</button><span/><button type="button" className="work-button work-button-quiet" onClick={onClose}>Cancelar</button><button className="work-button work-button-primary"><Check size={14}/>Salvar evento</button></footer></form></div>;
}

function ApprovalDetail({ approval, onClose, onRevokeShare, onWithdraw, onComment, onDecision, onRequestChanges, onOpenPortal }) {
  const [comment, setComment] = useState('');
  const [commentSaving, setCommentSaving] = useState(false);
  const commentLocks = useRef(null);
  if (!commentLocks.current) commentLocks.current = createKeyedActionLock();
  const [revision, setRevision] = useState(false);
  const submitComment = async (event) => {
    event.preventDefault();
    if (!comment.trim()) return;
    const result = await submitApprovalComment({
      locks: commentLocks.current,
      approvalId: approval.id,
      text: comment,
      save: async (text) => {
        setCommentSaving(true);
        try { return await onComment(text); }
        finally { setCommentSaving(false); }
      },
    });
    if (result?.ok === false || result?.skipped) return;
    setComment('');
  };
  return <div className="work-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="work-compose-modal approval-detail-modal" role="dialog" aria-modal="true" aria-label={`Aprovação ${approval.title}`}><header><div><span className="eyebrow">APROVAÇÃO · {approval.client}</span><h2>{approval.title}</h2></div><button type="button" aria-label="Fechar" onClick={onClose}><X size={18}/></button></header><div className="approval-detail-preview"><FileText size={28}/><b>{approval.title}</b><small>{approval.kind} - {approval.project}</small>{approval.attachment?.url ? <><a href={approval.attachment.url} target="_blank" rel="noreferrer">Abrir {approval.attachment.name || 'arquivo enviado'} no Google Drive</a>{approval.attachment.permissionId && <button type="button" className="work-button work-button-quiet" onClick={() => onRevokeShare(approval)}>Revogar acesso publico</button>}</> : <span>{approval.attachment?.localOnly ? 'Arquivo de demonstração; conteúdo não enviado.' : 'Sem arquivo real vinculado.'}</span>}</div><div className="approval-detail-meta"><span>Enviado<b>{approval.sent}</b></span><span>Revisor<b>{approval.reviewer}</b></span><span>Status<b>{approval.status}</b></span></div>{approval.clientComment && <article className="project-detail-comment"><b>Resposta do cliente</b><p>{approval.clientComment}</p></article>}<form className="project-detail-add-task" onSubmit={submitComment}><input disabled={commentSaving} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Registrar comentário ou orientação"/><button className="work-button work-button-quiet" disabled={commentSaving || !comment.trim()}><Send size={14}/>{commentSaving ? 'Salvando...' : 'Comentar'}</button></form>{approval.comments?.map((item) => <article className="project-detail-comment" key={item.id}><b>{item.text}</b><small>{new Date(item.at).toLocaleString('pt-BR')}</small></article>)}{isApprovalAwaitingDecision(approval.status) && <div className="approval-detail-actions"><button className="work-button work-button-quiet" onClick={() => setRevision(true)}>Solicitar ajustes</button><button className="work-button work-button-approve" onClick={async () => { const saved = await onDecision('Aprovado'); if (saved) onClose(); }}><Check size={14}/>Aprovar entrega</button></div>}{revision && <form className="approval-revision-form" onSubmit={async (event) => { event.preventDefault(); const saved = await onRequestChanges(comment.trim()); if (saved?.ok !== false) onClose(); }}><textarea required minLength={3} maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)} rows={3} placeholder="Descreva os ajustes solicitados"/><button className="work-button work-button-quiet">Enviar pedido de ajuste</button></form>}<footer>{isApprovalPending(approval.status) && <button type="button" className="work-button work-button-quiet file-remove" onClick={async () => { const saved = await onWithdraw(approval); if (saved) onClose(); }}>Retirar solicitação</button>}<button type="button" className="work-button work-button-quiet" disabled={!approval.clientId} onClick={() => onOpenPortal(approval)}>Abrir portal deste cliente</button><span>Decisões e comentários salvos no workspace.</span><button type="button" className="work-button work-button-quiet" onClick={onClose}>Fechar</button></footer></section></div>;
}

function FileDetail({ file, clients = [], projects = [], onAction = () => {}, onClose, onSave, onDelete }) {
  const association = fileAssociationDraft(file, clients, projects);
  const [draft, setDraft] = useState({ name: file.name || '', project: file.project || '', client: file.client || '', ...association });
  const associationTouched = useRef(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (associationTouched.current) return;
    setDraft((current) => ({ ...current, ...fileAssociationDraft(file, clients, projects) }));
  }, [file, clients, projects]);
  const save = async () => {
    const name = String(draft.name || '').trim();
    if (!name) return;
    if (saving) return;
    const resolvedAssociation = resolveFileAssociation(draft, clients, projects);
    if (resolvedAssociation.error) {
      onAction(resolvedAssociation.error === 'file_project_client_mismatch' ? 'O projeto selecionado pertence a outro cliente.' : 'Selecione um cliente ou projeto válido.');
      return;
    }
    setSaving(true);
    try {
      const result = await onSave({ ...draft, ...resolvedAssociation, name });
      if (result?.ok) setDraft((current) => ({ ...current, name }));
    } finally { setSaving(false); }
  };
  const matchingProjects = projects.filter((project) => {
    if (!draft.clientId) return true;
    const linkedClient = findProjectClient(project, clients);
    return !linkedClient || String(linkedClient.id) === String(draft.clientId);
  });
  const chooseClient = (clientId) => {
    associationTouched.current = true;
    const client = clients.find((item) => String(item.id) === String(clientId));
    const currentProject = projects.find((item) => String(item.id) === String(draft.projectId));
    const currentProjectClient = currentProject && findProjectClient(currentProject, clients);
    const keepProject = !currentProjectClient || String(currentProjectClient.id) === String(clientId);
    setDraft((current) => ({ ...current, clientId, client: String(client?.name || client?.title || ''), ...(keepProject ? {} : { projectId: '', project: '' }) }));
  };
  const chooseProject = (projectId) => {
    associationTouched.current = true;
    const project = projects.find((item) => String(item.id) === String(projectId));
    const projectClient = project && findProjectClient(project, clients);
    setDraft((current) => ({ ...current, projectId, project: String(project?.name || project?.title || ''), ...(projectClient ? { clientId: String(projectClient.id), client: String(projectClient.name || projectClient.title || '') } : {}) }));
  };
  const exportMetadata = () => { const blob = new Blob([JSON.stringify({ ...file, ...draft }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `${draft.name || 'arquivo'}-metadata.json`; link.click(); URL.revokeObjectURL(url); };
  return <div className="work-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="work-compose-modal file-detail-modal" role="dialog" aria-modal="true" aria-label={`Arquivo ${file.name}`}><header><div><span className="eyebrow">ARQUIVO · {file.type || 'DOCUMENTO'}</span><h2>{file.name}</h2></div><button type="button" aria-label="Fechar" onClick={onClose}><X size={18}/></button></header><div className="file-detail-meta"><span>Tipo<b>{file.folder ? 'Pasta' : file.type || 'Arquivo'}</b></span><span>Tamanho<b>{file.size || 'N\u00e3o informado'}</b></span><span>Adicionado<b>{file.date || 'Data n\u00e3o informada'}</b></span></div><div className="file-detail-fields"><label>Nome no Drive<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })}/></label><label>Projeto<select value={draft.projectId} onChange={(event) => chooseProject(event.target.value)}><option value="">Sem projeto vinculado</option>{matchingProjects.map((item) => <option key={item.id} value={item.id}>{item.name || item.title || 'Projeto'}</option>)}</select></label><label>Cliente<select value={draft.clientId} onChange={(event) => chooseClient(event.target.value)}><option value="">Sem cliente vinculado</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.name || item.title || 'Cliente'}</option>)}</select></label></div><div className="ns-integration-modal-note"><ShieldCheck size={15}/>{file.localOnly ? 'Demonstração local: metadados registrados; conteúdo não enviado.' : file.driveFileId ? 'Arquivo armazenado no Google Drive. Salvar um novo nome também renomeia o arquivo no Drive; cliente e projeto são metadados do workspace.' : 'Registro de metadados apenas; o arquivo original n\u00e3o foi enviado ao Google Drive.'}</div><footer><button type="button" className="work-button work-button-quiet file-remove" disabled={saving} onClick={onDelete}>Remover registro</button><span/>{file.driveFileId && <a className="work-button work-button-quiet" href={`https://drive.google.com/open?id=${encodeURIComponent(file.driveFileId)}`} target="_blank" rel="noopener noreferrer"><ArrowRight size={14}/>Abrir no Drive</a>}<button type="button" className="work-button work-button-quiet" disabled={saving} onClick={exportMetadata}><Download size={14}/>Exportar metadados</button><button type="button" className="work-button work-button-primary" disabled={saving || !String(draft.name || '').trim()} onClick={save}><Check size={14}/>{saving ? 'Salvando…' : 'Salvar'}</button></footer></section></div>;
}

function TaskDetail({ task, tasks, localDemo, onClose, onDelete, onSave, onFileUploaded, onAction }) {
  const [draft, setDraft] = useState({ ...task, checklist: task.checklist || [], comments: task.comments || [], description: task.description || '', recurrence: task.recurrence || 'Nao recorrente', estimatedMinutes: task.estimatedMinutes || '', dependency: task.dependency || '', attachment: task.attachment || '' });
  const [subtask, setSubtask] = useState('');
  const [comment, setComment] = useState('');
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [saving, setSaving] = useState(false);
  const checklist = draft.checklist.map((item) => typeof item === 'string' ? { title: item, done: false } : item);
  const save = async (event) => { event?.preventDefault(); if (saving) return; setSaving(true); try { const result = await onSave({ ...draft, checklist, updatedAt: new Date().toISOString() }); if (result?.skipped) return; if (result?.ok === false) { onAction(result.error?.message || 'Não foi possível salvar. Suas alterações continuam abertas.'); return; } onAction('Tarefa atualizada e salva.'); onClose(); } finally { setSaving(false); } };
  const uploadAttachment = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.size || file.size > 8 * 1024 * 1024) { onAction('O arquivo precisa ter até 8 MiB.'); event.target.value = ''; return; }
    if (localDemo) {
      const attachment = { name: file.name, size: file.size, mimeType: file.type || 'application/octet-stream', localOnly: true };
      const updated = { ...draft, attachment, updatedAt: new Date().toISOString() };
      const saved = await onSave(updated);
      if (saved?.ok === false) { onAction(saved.error?.message || 'Não foi possível vincular o arquivo à tarefa.'); event.target.value = ''; return; }
      setDraft(updated);
      const fileSaved = await onFileUploaded?.(attachment); if (fileSaved?.ok === false) onAction(fileSaved.error?.message || 'Arquivo vinculado à tarefa, mas não entrou na lista de arquivos.');
      onAction('Arquivo vinculado somente à demonstração local; o conteúdo não foi enviado.');
      event.target.value = '';
      return;
    }
    if (localDemo) {
      const updated = { ...draft, attachment: { name: file.name, size: file.size, mimeType: file.type || 'application/octet-stream', localOnly: true }, updatedAt: new Date().toISOString() };
      const saved = await onSave(updated);
      if (saved?.ok === false) { onAction(saved.error?.message || 'Não foi possível vincular o arquivo à tarefa.'); event.target.value = ''; return; }
      setDraft(updated);
      onAction('Arquivo vinculado somente à demonstração local; o conteúdo não foi enviado.');
      event.target.value = '';
      return;
    }
    setUploadingAttachment(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.')); reader.onload = () => resolve(String(reader.result || '')); reader.readAsDataURL(file); });
      const result = await apiRequest('/api/integrations/google/drive/upload', { method: 'POST', body: JSON.stringify({ name: file.name, mimeType: file.type || 'application/octet-stream', data: dataUrl.slice(dataUrl.indexOf(',') + 1), taskId: task.id }) });
      const updated = { ...draft, attachment: result.data, updatedAt: new Date().toISOString() };
      const saved = await onSave(updated);
      if (saved?.ok === false) { onAction(`Arquivo enviado ao Drive, mas não foi vinculado à tarefa: ${saved.error?.message || 'falha ao salvar a tarefa.'}`); return; }
      setDraft(updated);
      const listed = await onFileUploaded?.(result.data);
      onAction(listed?.ok === false ? `Anexo vinculado à tarefa, mas não entrou na lista de arquivos: ${listed.error?.message || 'falha ao salvar o arquivo.'}` : `Anexo enviado ao Drive e vinculado à tarefa: ${result.data.name}`);
    } catch (error) { onAction(error.message || 'Não foi possível enviar o anexo ao Google Drive.'); }
    finally { setUploadingAttachment(false); event.target.value = ''; }
  };
  const addSubtask = (event) => { event.preventDefault(); if (!subtask.trim()) return; setDraft({ ...draft, checklist: [...checklist, { id: Date.now(), title: subtask.trim(), done: false }] }); setSubtask(''); };
  const addComment = (event) => { event.preventDefault(); if (!comment.trim()) return; setDraft({ ...draft, comments: [{ id: Date.now(), text: comment.trim(), at: new Date().toISOString() }, ...draft.comments] }); setComment(''); };
  const detachAttachment = () => { setDraft((current) => withoutTaskAttachment(current)); onAction('Arquivo desvinculado da tarefa. O arquivo original continua no Drive. Salve a tarefa para confirmar.'); };
  return <div className="work-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="work-compose-modal task-detail-modal" role="dialog" aria-modal="true" aria-label={`Tarefa ${task.title}`}><header><div><span className="eyebrow">TAREFA · {draft.client || 'SEM CLIENTE'}</span><h2>{draft.title}</h2></div><button type="button" aria-label="Fechar" onClick={onClose}><X size={18}/></button></header><div className="task-detail-fields"><label>Status<select value={taskStatusForEdit(draft)} onChange={(event) => setDraft(withTaskStatus(draft, event.target.value))}>{['A fazer','Em andamento','Concluída'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Prioridade<select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>{['Baixa','Normal','Alta','Urgente'].map((value) => <option key={value}>{value}</option>)}</select></label><label>Respons&#225;vel<input value={draft.assignee || ''} onChange={(event) => setDraft({ ...draft, assignee: event.target.value })}/></label><label>Prazo<input value={draft.due || ''} onChange={(event) => setDraft({ ...draft, due: event.target.value })} placeholder="Ex.: 30 set"/></label><label>Tempo estimado (minutos)<input type="number" min="0" value={draft.estimatedMinutes} onChange={(event) => setDraft({ ...draft, estimatedMinutes: event.target.value })}/></label><label>Recorr&#234;ncia<select value={draft.recurrence} onChange={(event) => setDraft({ ...draft, recurrence: event.target.value })}>{['Nao recorrente','Diaria','Semanal','Mensal'].map((value) => <option key={value} value={value}>{value === 'Nao recorrente' ? 'N' + String.fromCharCode(227) + 'o recorrente' : value === 'Diaria' ? 'Di' + String.fromCharCode(225) + 'ria' : value}</option>)}</select></label><label>Depende de<select value={draft.dependency} onChange={(event) => setDraft({ ...draft, dependency: event.target.value })}><option value="">Sem depend&#234;ncia</option>{tasks.filter((item) => item.id !== task.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className="task-detail-wide">Descri&#231;&#227;o<textarea rows="3" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })}/></label></div><section className="project-detail-section"><div className="project-detail-heading"><div><h3>Checklist e subtarefas</h3><p>{checklist.filter((item) => item.done).length} de {checklist.length} conclu&#237;das</p></div></div><form className="project-detail-add-task" onSubmit={addSubtask}><input value={subtask} onChange={(event) => setSubtask(event.target.value)} placeholder="Adicionar uma subtarefa"/><button className="work-button work-button-quiet"><Plus size={14}/>Adicionar</button></form>{checklist.map((item,index) => <label className="task-subtask" key={item.id || `${item.title}-${index}`}><input type="checkbox" checked={Boolean(item.done)} onChange={(event) => setDraft({ ...draft, checklist: checklist.map((current,i) => i === index ? { ...current, done: event.target.checked } : current) })}/><span>{item.title}</span></label>)}</section><section className="project-detail-section"><div className="project-detail-heading"><div><h3>Coment&#225;rios</h3><p>Atualiza&#231;&#245;es registradas nesta tarefa</p></div></div><form className="project-detail-add-task" onSubmit={addComment}><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Adicionar comentario"/><button className="work-button work-button-quiet"><Send size={14}/>Registrar</button></form>{draft.comments.map((item) => <article className="project-detail-comment" key={item.id}><b>{item.text}</b><small>{new Date(item.at).toLocaleString('pt-BR')}</small></article>)}</section><div className="task-detail-attachment"><label>{localDemo ? 'Vincular arquivo de exemplo' : 'Anexar arquivo ao Google Drive'}<input type="file" disabled={uploadingAttachment} onChange={uploadAttachment}/></label>{uploadingAttachment && <small role="status">Enviando e vinculando &#224; tarefa&#8230;</small>}{draft.attachment && typeof draft.attachment === 'object' && (draft.attachment.localOnly ? <small>Arquivo de exemplo vinculado; o conteúdo não foi enviado.</small> : <a href={draft.attachment.url} target="_blank" rel="noreferrer">{draft.attachment.name} &#183; Abrir no Google Drive</a>)}{draft.attachment && typeof draft.attachment !== 'object' && <small>{draft.attachment} &#183; refer&#234;ncia antiga, ainda n&#227;o enviada.</small>}{draft.attachment && <button type="button" className="work-button work-button-quiet" disabled={saving || uploadingAttachment} onClick={detachAttachment}>Desvincular arquivo</button>}</div><footer><button type="button" className="work-button work-button-quiet file-remove" onClick={onDelete}>Excluir tarefa</button><span>Alterações sincronizadas ao salvar.</span><button type="button" className="work-button work-button-quiet" onClick={onClose}>Cancelar</button><button type="button" className="work-button work-button-primary" disabled={saving} onClick={save}><Check size={14}/>{saving ? "Salvando..." : "Salvar tarefa"}</button></footer></section></div>;
}

function ProjectDetail({ project, canArchive = true, clients, tasks, onClose, onUpdate, onTaskToggle, onAddTask, onAction }) {
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const addTaskLock = useRef(null);
  if (!addTaskLock.current) addTaskLock.current = createAsyncActionLock();
  const [details, setDetails] = useState(() => ({ status: project.status || 'A fazer', due: project.due || '', team: (project.team || []).filter(Boolean).join(', '), progress: Number(project.progress) || 0 }));
  useEffect(() => { setDetails({ status: project.status || 'A fazer', due: project.due || '', team: (project.team || []).filter(Boolean).join(', '), progress: Number(project.progress) || 0 }); }, [project.id]);
  const comments = project.comments || [];
  const taskProgress = summarizeProjectTasks(tasks);
  const addTask = async (event) => {
    event.preventDefault();
    if (!title.trim() || addTaskLock.current.locked) return;
    setAddingTask(true);
    try {
      const client = findProjectClient(project, clients);
      const result = await addTaskLock.current.run(() => onAddTask({
        id: globalThis.crypto?.randomUUID?.() || `project-task-${Date.now()}`,
        title: title.trim(), project: project.name, projectId: project.id,
        client: client?.name || client?.title || project.client,
        clientId: client?.id || project.clientId || '', due: project.due || 'A definir',
        assignee: (project.team || []).filter(Boolean)[0] || '', status: 'A fazer', priority: 'Normal',
      }));
      if (result?.ok === false) { onAction(result.error?.message || 'Falha ao adicionar a tarefa.'); return; }
      setTitle('');
      onAction('Tarefa adicionada ao projeto.');
    } finally { setAddingTask(false); }
  };
  const addComment = async (event) => { event.preventDefault(); if (!comment.trim()) return; const result = await onUpdate({ comments: [{ id: Date.now(), text: comment.trim(), at: new Date().toISOString() }, ...comments] }); if (result === false) return; setComment(''); onAction('Coment\u00e1rio salvo no projeto.'); };
  const saveDetails = async () => {
    if (details.status === 'Arquivado' && project.status !== 'Arquivado' && !canArchive) { onAction('Somente um administrador pode arquivar projetos.'); return; }
    if (details.status === 'Arquivado' && project.status !== 'Arquivado' && !window.confirm(`Arquivar "${project.name}"? O projeto e seu histórico permanecem no workspace e podem ser reabertos depois.`)) return;
    setSaving(true);
    try {
      const archivedAt = details.status === 'Arquivado' ? project.archivedAt || new Date().toISOString() : null;
      const result = await onUpdate({ status: details.status, archivedAt, due: details.due.trim(), team: details.team.split(',').map((item) => item.trim()).filter(Boolean), progress: Number(details.progress) || 0 });
      if (result !== false) onAction(details.status === 'Arquivado' ? 'Projeto arquivado. Você pode reabri-lo pelo campo Etapa.' : 'Detalhes do projeto atualizados.');
    } finally { setSaving(false); }
  };
  const archiveProject = async () => {
    if (!canArchive) { onAction('Somente um administrador pode arquivar projetos.'); return; }
    if (details.status === 'Arquivado' || saving) return;
    if (!window.confirm(`Arquivar "${project.name}"? O projeto e seu histórico permanecem no workspace e podem ser reabertos depois.`)) return;
    setSaving(true);
    try {
      const result = await onUpdate({ status: 'Arquivado', archivedAt: new Date().toISOString(), due: details.due.trim(), team: details.team.split(',').map((item) => item.trim()).filter(Boolean), progress: Number(details.progress) || 0 });
      if (result !== false) { onAction('Projeto arquivado. Você pode encontrá-lo pelo filtro Arquivado e reabri-lo depois.'); onClose(); }
    } finally { setSaving(false); }
  };
  return <div className="work-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="work-compose-modal project-detail-modal" role="dialog" aria-modal="true" aria-label={`Projeto ${project.name}`}><header><div><span className="eyebrow">PROJETO · {project.client}</span><h2>{project.name}</h2></div><button type="button" aria-label="Fechar" onClick={onClose}><X size={18}/></button></header><div className="project-detail-fields"><label>Etapa<select value={details.status} onChange={(event) => setDetails((current) => ({ ...current, status: event.target.value }))}>{['A fazer', 'Em andamento', 'Aguardando cliente', 'Conclu\u00eddo', 'Arquivado'].map((status) => <option key={status} disabled={!canArchive && status === 'Arquivado'}>{status}</option>)}</select></label><label>Prazo<input value={details.due} onChange={(event) => setDetails((current) => ({ ...current, due: event.target.value }))} placeholder="Ex.: 15 out" /></label><label>Respons&#225;veis<input value={details.team} onChange={(event) => setDetails((current) => ({ ...current, team: event.target.value }))} placeholder="Separe os nomes por v&#237;rgula" /></label><label>Progresso &#183; {details.progress}%<input type="range" min="0" max="100" value={details.progress} onChange={(event) => setDetails((current) => ({ ...current, progress: Number(event.target.value) }))} /></label></div><section className="project-detail-section"><div className="project-detail-heading"><div><h3>Tarefas do projeto</h3><p>{taskProgress.completed} de {tasks.length} concluídas</p></div></div><form className="project-detail-add-task" onSubmit={addTask}><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Adicionar tarefa ao projeto"/><button type="submit" className="work-button work-button-primary" disabled={addingTask}>{addingTask ? 'Adicionando…' : <><Plus size={14}/>Adicionar</>}</button></form><div className="project-detail-task-list">{tasks.map((task) => <button type="button" key={task.id} className={taskIsCompleted(task) ? 'done' : ''} onClick={() => onTaskToggle(task.id)}><span>{taskIsCompleted(task) ? <CheckCircle2 size={16}/> : <Circle size={16}/>}</span><b>{task.title}</b><small>{task.due || 'Sem prazo'} · {task.assignee || 'Sem responsável'}</small></button>)}{!tasks.length && <p>Este projeto ainda não possui tarefas vinculadas.</p>}</div></section><section className="project-detail-section"><div className="project-detail-heading"><div><h3>Comentários e decisões</h3><p>Notas internas salvas com este projeto.</p></div></div><form className="project-detail-add-task" onSubmit={addComment}><input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Registrar uma atualização"/><button className="work-button work-button-quiet"><Send size={14}/>Comentar</button></form>{comments.map((item) => <article className="project-detail-comment" key={item.id}><b>{item.text}</b><small>{new Date(item.at).toLocaleString('pt-BR')}</small></article>)}</section><footer><span>{saving ? 'Salvando detalhes...' : 'Revise os campos e salve as altera\u00e7\u00f5es.'}</span>{canArchive && details.status !== 'Arquivado' && <button type="button" className="work-button work-button-quiet" disabled={saving} onClick={archiveProject}>Arquivar projeto</button>}<button type="button" className="work-button work-button-quiet" onClick={onClose}>Fechar</button><button type="button" className="work-button work-button-primary" disabled={saving} onClick={saveDetails}><Check size={14} />Salvar altera&#231;&#245;es</button></footer></section></div>;
}

function ProjectCard({ project, onOpen }) { return <article className={`project-card project-${project.tone || 'lime'}`}><div className="project-card-top"><span className="project-type"><i />{project.type || 'Projeto'}</span><button className="row-more" aria-label={`Mais opções para ${project.name || 'projeto'}`} onClick={onOpen}><MoreHorizontal size={18} /></button></div><button className="project-name" onClick={onOpen}>{project.name || 'Projeto sem título'}<ArrowUpRight size={15} /></button><p className="project-client">{project.client || 'Sem cliente vinculado'}</p><div className="project-progress-label"><span>Progresso</span><strong>{Number(project.progress) || 0}%</strong></div><div className="project-progress"><i style={{ width: `${Math.max(0, Math.min(100, Number(project.progress) || 0))}%` }} /></div><div className="project-card-bottom"><StatusPill status={project.status} /><span className="project-due"><CalendarDays size={13} />{project.due || 'Sem prazo'}</span><div className="avatar-stack">{(Array.isArray(project.team) ? project.team : []).filter(Boolean).map((person) => <Avatar key={person} name={person} />)}</div></div></article>; }
function Empty({ title, text }) { return <div className="work-empty"><span><Sparkles size={18} /></span><strong>{title}</strong><p>{text}</p></div>; }
function FileCard({ file, onOpen, onMenu }) { const category = classifyWorkspaceFile(file); const type = String(file.type || 'file').toLocaleLowerCase('pt-BR'); const image = category === 'image'; const pdf = category === 'pdf'; const sheet = category === 'sheet'; const Icon = file.folder ? Folder : image ? FileImage : FileText; const typeLabel = image ? 'IMAGEM' : pdf ? 'PDF' : sheet ? 'PLANILHA' : category === 'document' || type === 'documento' || type === 'document' ? 'DOCUMENTO' : type.toUpperCase(); const typeClass = image ? 'Imagem' : pdf ? 'PDF' : sheet ? 'sheet' : category === 'document' || type === 'documento' || type === 'document' ? 'Documento' : type; return <article className="drive-card"><button className={`file-art ${file.folder ? 'file-folder' : `file-${typeClass}`}`} onClick={onOpen}><Icon size={file.folder ? 30 : 27} strokeWidth={1.6} />{!file.folder && <span>{typeLabel}</span>}</button><div className="drive-card-copy"><button className="file-name" title={file.name || 'Arquivo sem título'} aria-label={`Abrir arquivo ${file.name || 'Arquivo sem título'}`} onClick={onOpen}>{file.name || 'Arquivo sem título'}</button><small>{file.client || 'Sem cliente'} <span>·</span> {file.date || 'Data não informada'}</small></div><button className="row-more" aria-label={`Mais opções para ${file.name || 'arquivo'}`} onClick={onMenu}><MoreHorizontal size={18} /></button></article>; }

export { WorkScreen };
export default WorkScreen;
