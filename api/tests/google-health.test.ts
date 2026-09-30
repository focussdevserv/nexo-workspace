import assert from 'node:assert/strict';
import test from 'node:test';
import { googleCalendarTestDisposition } from '../src/integrations/google-health.js';

test('confirms Calendar connectivity only after a successful read request', () => {
  assert.equal(googleCalendarTestDisposition(200), 'connected');
  assert.equal(googleCalendarTestDisposition(204), 'connected');
});

test('reports missing Calendar authorization scopes separately from network errors', () => {
  assert.equal(googleCalendarTestDisposition(403), 'setup_required');
  assert.equal(googleCalendarTestDisposition(401), 'error');
  assert.equal(googleCalendarTestDisposition(503), 'error');
});
