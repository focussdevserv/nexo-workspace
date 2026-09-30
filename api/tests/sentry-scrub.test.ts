import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scrubSentryEvent } from '../src/integrations/sentry-scrub.js';

test('removes user, request payload, cookies, headers, query strings and breadcrumb values', () => {
  const event = {
    message: 'Unexpected API failure',
    user: { email: 'client@example.com', ip_address: '192.0.2.1' },
    request: { method: 'POST', url: 'https://focussdev.space/api/clients?email=client%40example.com#fragment', data: { name: 'Client Name' }, cookies: 'session=secret', headers: { Authorization: 'Bearer secret' }, query_string: 'email=client@example.com' },
    breadcrumbs: [{ category: 'fetch', message: 'request email=client@example.com', data: { body: 'private' }, timestamp: 1 }],
  };
  const safe = scrubSentryEvent(event);
  assert.equal('user' in safe, false);
  assert.deepEqual(safe.request, { method: 'POST', url: 'https://focussdev.space/api/clients' });
  assert.deepEqual(safe.breadcrumbs, [{ category: 'fetch', timestamp: 1 }]);
  assert.ok(event.user, 'the sanitizer does not mutate the caller event');
});

test('leaves useful error stack and method context intact when request data is absent', () => {
  const safe = scrubSentryEvent({ message: 'database unavailable', exception: { values: [] }, request: { method: 'GET', url: '/api/health?private=1' } });
  assert.equal(safe.message, 'database unavailable');
  assert.deepEqual(safe.request, { method: 'GET', url: '/api/health' });
});
