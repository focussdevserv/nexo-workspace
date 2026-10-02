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
