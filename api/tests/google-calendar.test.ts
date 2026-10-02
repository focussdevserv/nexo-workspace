import assert from 'node:assert/strict';
import test from 'node:test';
import { googleCalendarAttendeesPayload, mapGoogleCalendarEvents } from '../src/integrations/google-calendar.js';

test('calendar update includes an empty attendee list so all guests can be removed', () => {
  assert.deepEqual(googleCalendarAttendeesPayload([]), { attendees: [] });
  assert.deepEqual(googleCalendarAttendeesPayload(['guest@example.test']), { attendees: [{ email: 'guest@example.test' }] });
});

test('maps timed Google events to São Paulo time and exposes meeting metadata', () => {
  const [event] = mapGoogleCalendarEvents([{
    id: 'remote123', summary: 'Planning', description: 'Review sprint',
    start: { dateTime: '2026-10-01T15:00:00Z' }, end: { dateTime: '2026-10-01T16:00:00Z' },
    attendees: [{ email: 'person@example.test' }], hangoutLink: 'https://meet.google.com/abc-defg-hij',
  }]);
  assert.equal(event.date, '2026-10-01');
  assert.equal(event.time, '12:00');
  assert.equal(event.end, '13:00');
  assert.equal(event.googleEventId, 'remote123');
  assert.equal(event.googleMeetUrl, 'https://meet.google.com/abc-defg-hij');
  assert.equal(event.people, 'person@example.test');
  assert.equal(event.calendarSource, 'google');
});

test('maps all-day events and ignores canceled or malformed Calendar entries', () => {
  const events = mapGoogleCalendarEvents([
    { id: 'allday1', summary: 'Holiday', start: { date: '2026-10-02' }, end: { date: '2026-10-03' } },
    { id: 'canceled', status: 'cancelled', start: { dateTime: '2026-10-02T12:00:00Z' }, end: { dateTime: '2026-10-02T13:00:00Z' } },
    { summary: 'Missing ID', start: { dateTime: '2026-10-02T12:00:00Z' } },
    null,
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].allDay, true);
  assert.equal(events[0].time, '00:00');
  assert.equal(events[0].end, '23:59');
});

test('maps timed events using a workspace-selected timezone', () => {
  const [event] = mapGoogleCalendarEvents([{
    id: 'remote789', summary: 'Review',
    start: { dateTime: '2026-01-10T15:00:00Z' }, end: { dateTime: '2026-01-10T16:00:00Z' },
  }], 'America/New_York');
  assert.equal(event.date, '2026-01-10');
  assert.equal(event.time, '10:00');
  assert.equal(event.end, '11:00');
});
