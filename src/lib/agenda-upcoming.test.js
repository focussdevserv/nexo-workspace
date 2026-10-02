import assert from 'node:assert/strict';
import test from 'node:test';
import { isAgendaEventUpcoming, nextAgendaEventTime, upcomingAgendaEvents } from './agenda-upcoming.js';

const now = new Date('2026-10-02T22:37:00.000Z'); // 19:37 in Sao Paulo; 07:37 on Oct 3 in Tokyo.

test('upcoming agenda excludes earlier same-day events and uses workspace clock', () => {
  const events = [
    { id: 'past', date: '2026-10-02', time: '15:00' },
    { id: 'future', date: '2026-10-02', time: '20:00' },
  ];
  assert.deepEqual(upcomingAgendaEvents(events, { now, timeZone: 'America/Sao_Paulo' }).map((event) => event.id), ['future']);
  assert.deepEqual(upcomingAgendaEvents(events, { now, timeZone: 'Asia/Tokyo' }).map((event) => event.id), []);
});

test('selected future date remains upcoming while past dates and past clock times do not', () => {
  assert.equal(isAgendaEventUpcoming({ date: '2026-10-03', time: '08:00' }, { now, timeZone: 'America/Sao_Paulo', fromDateKey: '2026-10-03' }), true);
  assert.equal(isAgendaEventUpcoming({ date: '2026-10-01', time: '23:00' }, { now, timeZone: 'America/Sao_Paulo' }), false);
  assert.equal(isAgendaEventUpcoming({ date: '2026-10-02', time: '19:00' }, { now, timeZone: 'America/Sao_Paulo' }), false);
});

test('overnight events are future by their start time, not by their next-day end', () => {
  const beforeStart = { date: '2026-10-02', time: '23:30', end: '00:30', endDate: '2026-10-03' };
  const afterStart = { date: '2026-10-02', time: '23:30', end: '00:30', endDate: '2026-10-03' };
  assert.equal(isAgendaEventUpcoming(beforeStart, { now, timeZone: 'America/Sao_Paulo' }), true);
  assert.equal(isAgendaEventUpcoming(afterStart, { now: new Date('2026-10-03T03:00:00.000Z'), timeZone: 'America/Sao_Paulo' }), false);
});

test('day summary picks the first timed event still ahead on the selected day', () => {
  const events = [
    { date: '2026-10-02', time: '15:00' },
    { date: '2026-10-02', time: '20:15' },
  ];
  assert.equal(nextAgendaEventTime(events, '2026-10-02', { now, timeZone: 'America/Sao_Paulo' }), '20:15');
  assert.equal(nextAgendaEventTime(events, '2026-10-03', { now, timeZone: 'America/Sao_Paulo' }), '');
  assert.equal(nextAgendaEventTime(events, '2026-10-01', { now, timeZone: 'America/Sao_Paulo' }), '');
});
