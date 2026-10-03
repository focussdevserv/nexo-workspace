import test from 'node:test';
import assert from 'node:assert/strict';
import { selectDashboardHighlightedEvent } from './dashboard-highlighted-event.js';

const now = new Date('2026-10-02T15:30:00.000Z');
const timeZone = 'America/Sao_Paulo';

test('Meu Dia highlights an event that is currently in progress', () => {
  const active = { id: 'active', time: '12:00', durationMinutes: 45 };
  const next = { id: 'next', time: '13:00' };

  assert.deepEqual(selectDashboardHighlightedEvent([next, active], { now, timeZone }), { event: active, status: 'active' });
});

test('Meu Dia highlights the nearest upcoming event when nothing is active', () => {
  const later = { id: 'later', time: '13:15' };
  const next = { id: 'next', startsAt: '2026-10-02T15:45:00.000Z' };

  assert.deepEqual(selectDashboardHighlightedEvent([later, next], { now, timeZone }), { event: next, status: 'upcoming' });
});

test('Meu Dia falls back to an event with no time instead of showing the agenda as free', () => {
  const unscheduled = { id: 'unscheduled', title: 'Compromisso sem horário' };
  const past = { id: 'past', time: '11:00' };

  assert.deepEqual(selectDashboardHighlightedEvent([past, unscheduled], { now, timeZone }), { event: unscheduled, status: 'unscheduled' });
});

test('Meu Dia labels an all-day event distinctly from one without a scheduled time', () => {
  const allDay = { id: 'all-day', title: 'Feriado local', allDay: true };
  const unscheduled = { id: 'unscheduled', title: 'Retorno quando possível' };

  assert.deepEqual(selectDashboardHighlightedEvent([unscheduled, allDay], { now, timeZone }), { event: allDay, status: 'all-day' });
});

test('Meu Dia returns the idle state when there are no events', () => {
  assert.deepEqual(selectDashboardHighlightedEvent([], { now, timeZone }), { event: null, status: 'idle' });
});

test('Meu Dia does not highlight past events when the day has no remaining events', () => {
  const past = { id: 'past', time: '10:00', durationMinutes: 30 };

  assert.deepEqual(selectDashboardHighlightedEvent([past], { now, timeZone }), { event: null, status: 'idle' });
});
