import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardEventNavigationContext } from './dashboard-event-navigation.js';

test('dashboard agenda action opens the selected event by its stable ID', () => {
  assert.deepEqual(dashboardEventNavigationContext({ id: 'event-42', title: 'Revisão' }), { eventId: 'event-42' });
});

test('dashboard agenda action does not invent an ID for incomplete event data', () => {
  assert.equal(dashboardEventNavigationContext({ title: 'Revisão' }), null);
  assert.equal(dashboardEventNavigationContext(null), null);
});

test('dashboard links a Google-only event by provider ID and its workspace calendar date', () => {
  assert.deepEqual(dashboardEventNavigationContext({ id: 'google-abc', googleEventId: 'abc', calendarSource: 'google', date: '2026-10-03' }), {
    googleEventId: 'abc', eventDate: '2026-10-03',
  });
});

test('dashboard keeps a linked workspace event on its internal record context', () => {
  assert.deepEqual(dashboardEventNavigationContext({ id: 'internal-1', googleEventId: 'abc', date: '2026-10-03' }), { eventId: 'internal-1' });
});
