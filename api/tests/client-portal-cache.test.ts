import assert from 'node:assert/strict';
import test from 'node:test';
import { applyClientPortalCachePolicy } from '../src/security/client-portal-cache.js';

test('client portal responses cannot be stored by browsers or shared caches', () => {
  const headers = new Map<string, string>();
  applyClientPortalCachePolicy({ header: (name, value) => { headers.set(name, value); } });
  assert.equal(headers.get('Cache-Control'), 'no-store, private');
  assert.equal(headers.get('Pragma'), 'no-cache');
  assert.equal(headers.get('Expires'), '0');
});
