import test from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest } from './workspace-api.js';

function jsonResponse(data) {
  return {
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => data,
  };
}

test('does not label bodyless requests as JSON', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_path, options) => {
    assert.equal(options.method, 'DELETE');
    assert.equal(options.headers['Content-Type'], undefined);
    return jsonResponse({ data: { revoked: true } });
  };

  try {
    const result = await apiRequest('/api/workspace/clients/example/portal-link', { method: 'DELETE' });
    assert.deepEqual(result.data, { revoked: true });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('keeps JSON content type when a request has a body', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_path, options) => {
    assert.equal(options.headers['Content-Type'], 'application/json');
    return jsonResponse({ data: true });
  };

  try {
    await apiRequest('/api/workspace/clients', { method: 'POST', body: '{}' });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('accepts a successful 204 response with no body', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (_path, options) => {
    assert.equal(options.method, 'DELETE');
    return {
      status: 204,
      ok: true,
      headers: { get: () => null },
      json: async () => { throw new Error('204 responses have no body'); },
    };
  };

  try {
    const result = await apiRequest('/api/workspace/clients/example', { method: 'DELETE' });
    assert.deepEqual(result, { data: null });
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('deduplicates concurrent GET requests for the same workspace resource', async () => {
  const previousFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return jsonResponse({ data: [] });
  };
  try {
    const [first, second] = await Promise.all([
      apiRequest('/api/workspace/clients?limit=200&offset=0'),
      apiRequest('/api/workspace/clients?limit=200&offset=0'),
    ]);
    assert.equal(calls, 1);
    assert.deepEqual(first, second);
    assert.notEqual(first.data, second.data, 'each consumer gets its own response objects');
    await apiRequest('/api/workspace/clients?limit=200&offset=0');
    assert.equal(calls, 1, 'a just-fetched GET response is reused briefly');
    await apiRequest('/api/workspace/clients', { method: 'POST', body: JSON.stringify({ data: {} }) });
    await apiRequest('/api/workspace/clients?limit=200&offset=0');
    assert.equal(calls, 3, 'a write clears cached GET responses before the next read');
  } finally { globalThis.fetch = previousFetch; }
});
