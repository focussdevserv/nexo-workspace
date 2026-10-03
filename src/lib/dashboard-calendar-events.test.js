import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { dashboardCalendarDayQuery, mergeDashboardCalendarEvents } from './dashboard-calendar-events.js';

test('dashboard requests the Google Calendar day in the workspace timezone', () => {
  const query = dashboardCalendarDayQuery(new Date('2026-10-03T02:00:00.000Z'), 'America/Sao_Paulo');
  assert.equal(query.get('from'), '2026-10-02');
  assert.equal(query.get('to'), '2026-10-02');
  assert.equal(query.get('timeZone'), 'America/Sao_Paulo');
});

test('dashboard combines workspace and Google events without duplicating linked Google records', () => {
  const workspace = [
    { id: 'internal-1', date: '2026-10-03', googleEventId: 'g-linked' },
    { id: 'internal-2', date: '2026-10-03' },
  ];
  const google = [
    { id: 'google-g-linked', googleEventId: 'g-linked', calendarSource: 'google' },
    { id: 'google-g-only', googleEventId: 'g-only', calendarSource: 'google' },
  ];

  const result = mergeDashboardCalendarEvents(workspace, google);
  assert.deepEqual(result.map((event) => event.id), ['internal-1', 'internal-2', 'google-g-only']);
  assert.equal(result[0], workspace[0]);
  assert.equal(workspace.length, 2);
});

test('dashboard merge tolerates malformed collections and keeps valid external events without provider IDs', () => {
  const events = mergeDashboardCalendarEvents([null, 'bad'], [
    { id: 'google-1', googleEventId: 'one' },
    { id: 'google-duplicate', googleEventId: 'one' },
    { id: 'external-without-provider-id' },
    { id: 'external-without-provider-id' },
    { title: 'invalid: no stable ID' },
  ]);
  assert.deepEqual(events.map((event) => event.id), ['google-1', 'external-without-provider-id']);
});

test('a failed dashboard Google Calendar refresh preserves the last loaded events', async () => {
  const source = await readFile(new URL('../App.jsx', import.meta.url), 'utf8');
  const effectStart = source.indexOf('apiRequest(`/api/integrations/google/calendar/events?${query.toString()}`)');
  const catchStart = source.indexOf('.catch((error) =>', effectStart);
  const effectEnd = source.indexOf('\n    return () => { active = false; };', catchStart);
  assert.ok(effectStart >= 0 && catchStart > effectStart && effectEnd > catchStart);
  const failureHandler = source.slice(catchStart, effectEnd);
  assert.match(failureHandler, /setDashboardCalendarFailure\(dashboardCalendarError/);
  assert.doesNotMatch(failureHandler, /setDashboardGoogleCalendarEvents\(\[\]\)/);
});
