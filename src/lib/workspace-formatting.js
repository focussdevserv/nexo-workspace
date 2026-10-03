import {
  normalizeWorkspaceCurrency,
  normalizeWorkspaceDateFormat,
  normalizeWorkspaceLocale,
} from './workspace-preferences.js';

function toDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (dateOnly) {
      const date = new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12));
      if (date.getUTCFullYear() !== Number(dateOnly[1]) || date.getUTCMonth() !== Number(dateOnly[2]) - 1 || date.getUTCDate() !== Number(dateOnly[3])) return null;
      return date;
    }
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatWorkspaceNumber(value, preferences = {}, options = {}) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat(normalizeWorkspaceLocale(preferences.language), options).format(amount);
  } catch {
    return new Intl.NumberFormat('pt-BR', options).format(amount);
  }
}

export function formatWorkspaceCurrency(value, preferences = {}, options = {}) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat(normalizeWorkspaceLocale(preferences.language), {
      style: 'currency',
      currency: normalizeWorkspaceCurrency(preferences.currency),
      ...options,
    }).format(amount);
  } catch {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', ...options }).format(amount);
  }
}

export function formatWorkspaceDate(value, preferences = {}, options = {}) {
  const date = toDate(value);
  if (!date) return '—';
  const format = normalizeWorkspaceDateFormat(preferences.dateFormat);
  try {
    const timeZone = options.timeZone || 'UTC';
    if (options.month) {
      const dateOptions = { timeZone };
      if (options.weekday) dateOptions.weekday = options.weekday;
      if (options.day) dateOptions.day = options.day;
      if (options.month) dateOptions.month = options.month;
      if (options.year) dateOptions.year = options.year;
      return new Intl.DateTimeFormat(normalizeWorkspaceLocale(preferences.language), dateOptions).format(date);
    }
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone,
    }).formatToParts(date).map((part) => [part.type, part.value]));
    const formattedDate = format === 'MM/dd/yyyy'
      ? `${parts.month}/${parts.day}/${parts.year}`
      : format === 'yyyy-MM-dd'
        ? `${parts.year}-${parts.month}-${parts.day}`
        : `${parts.day}/${parts.month}/${parts.year}`;
    if (!options.weekday) return formattedDate;
    const weekday = new Intl.DateTimeFormat(normalizeWorkspaceLocale(preferences.language), { weekday: options.weekday, timeZone }).format(date);
    return `${weekday}, ${formattedDate}`;
  } catch {
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', ...options, timeZone: 'UTC' }).format(date);
  }
}

export function formatWorkspaceDateTime(value, preferences = {}, options = {}) {
  const date = toDate(value);
  if (!date) return '—';
  try {
    const dateLabel = formatWorkspaceDate(date, preferences, { timeZone: options.timeZone });
    const timeLabel = new Intl.DateTimeFormat(normalizeWorkspaceLocale(preferences.language), { hour: '2-digit', minute: '2-digit', timeZone: options.timeZone }).format(date);
    return `${dateLabel} ${timeLabel}`;
  } catch {
    const dateLabel = formatWorkspaceDate(date, preferences, { timeZone: 'UTC' });
    const timeLabel = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(date);
    return `${dateLabel} ${timeLabel}`;
  }
}

export function formatWorkspaceTime(value, preferences = {}, options = {}) {
  const date = toDate(value);
  if (!date) return '—';
  try {
    return new Intl.DateTimeFormat(normalizeWorkspaceLocale(preferences.language), {
      hour: '2-digit', minute: '2-digit', timeZone: options.timeZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(date);
  }
}
