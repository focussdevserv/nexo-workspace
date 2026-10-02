import assert from 'node:assert/strict';
import test from 'node:test';
import { logoutWorkspace } from './workspace-session.js';

function createStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    values,
    removeItem(key) { values.delete(key); },
  };
}

test('logout invalidates the server cookie before clearing local session state', async () => {
  const storage = createStorage({ 'nexo.api.user': '{"role":"owner"}', 'nexo.workspace.activePage': 'CRM', 'focusshub.theme': 'dark' });
  let requestOptions;
  await logoutWorkspace({
    request: async (path, options) => { requestOptions = { path, options }; },
    storage,
  });

  assert.deepEqual(requestOptions, { path: '/api/auth/logout', options: { method: 'POST', body: '{}' } });
  assert.equal(storage.values.has('nexo.api.user'), false);
  assert.equal(storage.values.has('nexo.workspace.activePage'), false);
  assert.equal(storage.values.get('focusshub.theme'), 'dark');
});

test('logout preserves local session state when the server cannot clear its cookie', async () => {
  const storage = createStorage({ 'nexo.api.user': '{"role":"owner"}', 'nexo.workspace.activePage': 'CRM' });

  await assert.rejects(logoutWorkspace({ request: async () => { throw new Error('offline'); }, storage }), /offline/);
  assert.equal(storage.values.get('nexo.api.user'), '{"role":"owner"}');
  assert.equal(storage.values.get('nexo.workspace.activePage'), 'CRM');
});
