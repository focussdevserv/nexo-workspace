import { calendarDateKeyForValue, calendarDateKeyInTimeZone, DEFAULT_CALENDAR_TIME_ZONE, normalizeCalendarTimeZone } from './calendar-preferences.js';

function timePartsAt(value, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: normalizeCalendarTimeZone(timeZone), hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(value);
  return { hour: Number(parts.find((part) => part.type === 'hour')?.value), minute: Number(parts.find((part) => part.type === 'minute')?.value) };
}

function parseClock(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

export function isWithinWorkspaceQuietHours(now, preferences = {}, timeZone = DEFAULT_CALENDAR_TIME_ZONE) {
  if (preferences.quietHours !== true) return false;
  const start = parseClock(preferences.quietStart);
  const end = parseClock(preferences.quietEnd);
  if (start == null || end == null || start === end) return false;
  const { hour, minute } = timePartsAt(now, timeZone);
  const current = hour * 60 + minute;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

export function activityNotificationPreference(item) {
  if (item?.entityType === 'leads') return 'newLead';
  if (item?.entityType === 'proposals') return 'proposal';
  if (['billing_order', 'billing_subscription'].includes(item?.entityType)) return 'payment';
  return null;
}

export function shouldSendActivityBrowserAlert(item, preferences = {}, options = {}) {
  const timeZone = options.timeZone || DEFAULT_CALENDAR_TIME_ZONE;
  if (preferences.browser !== true || options.permission !== 'granted' || options.visible !== false) return false;
  if (isWithinWorkspaceQuietHours(options.now || new Date(), preferences, timeZone)) return false;
  const preference = activityNotificationPreference(item);
  return Boolean(preference && preferences[preference] !== false);
}

function normalizedStatus(task) {
  return String(task?.state || task?.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

export function taskReminderCandidates(tasks, preferences = {}, options = {}) {
  if (preferences.browser !== true || options.permission !== 'granted') return [];
  const now = options.now || new Date();
  const timeZone = options.timeZone || DEFAULT_CALENDAR_TIME_ZONE;
  if (isWithinWorkspaceQuietHours(now, preferences, timeZone)) return [];
  const today = calendarDateKeyInTimeZone(now, timeZone);
  const todayValue = new Date(`${today}T12:00:00.000Z`).getTime();

  return (Array.isArray(tasks) ? tasks : []).flatMap((task) => {
    const status = normalizedStatus(task);
    if (!task?.id || ['concluida', 'concluido', 'completed', 'done', 'cancelada', 'cancelado', 'cancelled'].includes(status)) return [];
    const due = calendarDateKeyForValue(task.dueAt || task.dueDate || task.due, timeZone);
    if (!due) return [];
    const dayOffset = Math.round((new Date(`${due}T12:00:00.000Z`).getTime() - todayValue) / 86_400_000);
    if (dayOffset < 0 && preferences.overdue !== false) return [{
      key: `${task.id}:overdue:${due}`, taskId: String(task.id), page: 'Tarefas', title: 'Tarefa atrasada',
      body: `${task.title || 'Tarefa sem título'} está atrasada há ${Math.abs(dayOffset)} ${Math.abs(dayOffset) === 1 ? 'dia' : 'dias'}.`,
    }];
    if (dayOffset >= 0 && dayOffset <= 1 && preferences.taskDue !== false) return [{
      key: `${task.id}:due:${due}`, taskId: String(task.id), page: 'Tarefas', title: dayOffset === 0 ? 'Tarefa vence hoje' : 'Prazo de tarefa se aproximando',
      body: `${task.title || 'Tarefa sem título'} · ${dayOffset === 0 ? 'vence hoje' : 'vence amanhã'}.`,
    }];
    return [];
  });
}
