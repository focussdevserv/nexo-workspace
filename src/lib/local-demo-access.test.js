import test from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest } from './workspace-api.js';
import { activateLocalDemo, exitLocalDemo, getLocalDemoUser, isLocalDemoActive } from './local-demo.js';

test('production demo mode is explicitly opt-in, isolated to browser storage, and intercepts APIs', async () => {
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const originalSessionStorage = globalThis.sessionStorage;
  const originalFetch = globalThis.fetch;
  const originalCustomEvent = globalThis.CustomEvent;
  const values = new Map();
  const session = new Map();
  let networkCalls = 0;
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  globalThis.sessionStorage = {
    getItem: (key) => session.get(key) ?? null,
    setItem: (key, value) => session.set(key, value),
    removeItem: (key) => session.delete(key),
  };
  globalThis.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
  globalThis.window = { location: { origin: 'https://focussdev.space', hostname: 'focussdev.space' }, dispatchEvent: () => {} };
  globalThis.fetch = async () => { networkCalls += 1; throw new Error('production API must not be called in demo mode'); };

  try {
    assert.equal(isLocalDemoActive(), false, 'production should not enter the demo without opt-in');
    activateLocalDemo();
    assert.equal(isLocalDemoActive(), true);
    assert.equal(getLocalDemoUser().organizationId, 'local-demo-org');

    const clients = await apiRequest('/api/workspace/clients?limit=200&offset=0');
    assert.ok(clients.data.length >= 6, 'the preview includes populated workspace data');
    assert.ok(clients.data.every((client) => client.demo === true));
    const projects = await apiRequest('/api/workspace/projects?limit=200&offset=0');
    const files = await apiRequest('/api/workspace/files?limit=200&offset=0');
    const projectById = new Map(projects.data.map((project) => [String(project.id), project]));
    assert.ok(files.data.every((file) => projectById.get(String(file.projectId))?.clientId === file.clientId), 'each demo file is linked to a project owned by the same client');
    const contacts = await apiRequest('/api/workspace/contacts?limit=200&offset=0');
    assert.equal(contacts.data.length, 9);
    assert.equal(new Set(contacts.data.map((contact) => contact.email.toLowerCase())).size, contacts.data.length, 'each sample contact has a distinct email');
    assert.equal(new Set(contacts.data.map((contact) => contact.phone)).size, contacts.data.length, 'each sample contact has a distinct phone number');
    const legacyStore = JSON.parse(values.get('focusshub.local-demo.v1'));
    legacyStore.contacts[8] = { ...legacyStore.contacts[8], email: legacyStore.contacts[0].email, phone: legacyStore.contacts[0].phone };
    values.set('focusshub.local-demo.v1', JSON.stringify(legacyStore));
    const migratedContacts = await apiRequest('/api/workspace/contacts?limit=200&offset=0');
    assert.equal(migratedContacts.data[8].email, 'paula@aurora.local');
    assert.notEqual(migratedContacts.data[8].phone, migratedContacts.data[0].phone, 'legacy sample duplicate is repaired without restoring all demo data');
    const oldBrisa = legacyStore.clients[6];
    const legacyCuboProject = legacyStore.projects[6];
    legacyStore.files[6] = { ...legacyStore.files[6], client: oldBrisa.name, clientId: oldBrisa.id, project: legacyCuboProject.name, projectId: legacyCuboProject.id };
    values.set('focusshub.local-demo.v1', JSON.stringify(legacyStore));
    const migratedFiles = await apiRequest('/api/workspace/files?limit=200&offset=0');
    assert.equal(migratedFiles.data[6].clientId, projectById.get(String(migratedFiles.data[6].projectId))?.clientId, 'legacy untouched file links migrate to the owning project client');
    const integration = await apiRequest('/api/integrations/waha/status');
    assert.equal(integration.status, 'demo_only');
    assert.equal(networkCalls, 0, 'demo reads and integration requests stay in the browser');

    const snapshot = values.get('focusshub.local-demo.v1');
    exitLocalDemo();
    assert.equal(isLocalDemoActive(), false);
    assert.equal(values.get('focusshub.local-demo.v1'), snapshot, 'exiting demo preserves its local sample data');
  } finally {
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    if (originalStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = originalStorage;
    if (originalSessionStorage === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = originalSessionStorage;
    if (originalFetch === undefined) delete globalThis.fetch; else globalThis.fetch = originalFetch;
    if (originalCustomEvent === undefined) delete globalThis.CustomEvent; else globalThis.CustomEvent = originalCustomEvent;
  }
});
