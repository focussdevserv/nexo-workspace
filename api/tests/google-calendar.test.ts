import assert from 'node:assert/strict';
import test from 'node:test';
import { mapGoogleCalendarEvents } from '../src/integrations/google-calendar.js';

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
