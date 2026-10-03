import assert from 'node:assert/strict';
import test from 'node:test';
import { checkLocalDemoSite, configureLocalDemoSiteSchedule, getLocalDemoSiteHistory, removeLocalDemoSiteAsset } from './local-demo-monitoring.js';
import { handleLocalDemoRequest } from './local-demo.js';

test('local demo site checks update the asset and persist a clearly simulated history entry', () => {
  const store = { 'site-assets': [{ id: 'demo-site-assets-1', name: 'Site Aurora', health: 'Não verificado' }] };
  const now = new Date('2026-10-02T12:00:00.000Z');

  const checked = checkLocalDemoSite(store, 'demo-site-assets-1', now);

  assert.equal(checked.health, 'Online');
  assert.equal(checked.demo, true);
  assert.equal(checked.demoTag, 'VERIFICAÇÃO SIMULADA · SEM CONSULTA EXTERNA');
  assert.equal(store['site-assets'][0].checkedAt, now.toISOString());
  assert.equal(getLocalDemoSiteHistory(store, 'demo-site-assets-1')[0].payload.simulated, true);
});

test('local demo site history is empty before checks and rejects missing assets', () => {
  const store = { 'site-assets': [{ id: 'demo-site-assets-1' }] };
  assert.deepEqual(getLocalDemoSiteHistory(store, 'demo-site-assets-1'), []);
  assert.throws(() => checkLocalDemoSite(store, 'missing'), /Ativo não encontrado/);
  assert.throws(() => getLocalDemoSiteHistory(store, 'missing'), /Ativo não encontrado/);
});

test('local demo monitoring history stays capped at fifty entries', () => {
  const store = {
    'site-assets': [{ id: 'demo-site-assets-1' }],
    siteMonitorHistory: { 'demo-site-assets-1': Array.from({ length: 50 }, (_, index) => ({ id: `old-${index}` })) },
  };
  checkLocalDemoSite(store, 'demo-site-assets-1', new Date('2026-10-02T12:00:00.000Z'));
  const history = getLocalDemoSiteHistory(store, 'demo-site-assets-1');
  assert.equal(history.length, 50);
  assert.equal(history[0].id, 'demo-check-demo-site-assets-1-1790942400000');
});

test('local demo site removal also clears all linked schedules and preserves unrelated records', () => {
  const store = {
    'site-assets': [{ id: 'site-1' }, { id: 'site-2' }],
    monitors: [{ id: 'monitor-1', siteAssetId: 'site-1' }, { id: 'monitor-2', siteAssetId: 'site-1' }, { id: 'monitor-3', siteAssetId: 'site-2' }, { id: 'monitor-orphan' }],
    siteMonitorHistory: { 'site-1': [{ id: 'history-1' }], 'site-2': [{ id: 'history-2' }] },
  };

  assert.equal(removeLocalDemoSiteAsset(store, 'site-1'), true);
  assert.deepEqual(store['site-assets'].map(({ id }) => id), ['site-2']);
  assert.deepEqual(store.monitors.map(({ id }) => id), ['monitor-3', 'monitor-orphan']);
  assert.deepEqual(store.siteMonitorHistory, { 'site-2': [{ id: 'history-2' }] });
  assert.equal(removeLocalDemoSiteAsset(store, 'missing'), false);
});

test('local demo monitor scheduling creates, updates, pauses, and deduplicates only the selected site schedule', () => {
  const store = {
    'site-assets': [{ id: 'site-1', name: 'Site Aurora' }, { id: 'site-2', name: 'Site Beta' }],
    monitors: [
      { id: 'old-a', siteAssetId: 'site-1', enabled: false },
      { id: 'active-a', siteAssetId: 'site-1', enabled: true },
      { id: 'other', siteAssetId: 'site-2', enabled: true },
      { id: 'unlinked' },
    ],
  };
  const now = new Date('2026-10-03T12:00:00.000Z');

  const configured = configureLocalDemoSiteSchedule(store, 'site-1', { enabled: true, intervalMinutes: 30 }, now);
  assert.equal(configured.schedules.length, 1);
  assert.equal(configured.schedules[0].id, 'active-a');
  assert.equal(configured.schedules[0].nextCheckAt, '2026-10-03T12:30:00.000Z');
  assert.deepEqual(store.monitors.map(({ id }) => id), ['active-a', 'other', 'unlinked']);
  assert.equal(store.monitors[0].name, 'Site Aurora');

  const paused = configureLocalDemoSiteSchedule(store, 'site-1', { enabled: false, intervalMinutes: 30 }, now);
  assert.equal(paused.schedules[0].enabled, false);
  assert.equal(paused.schedules[0].nextCheckAt, null);
  assert.throws(() => configureLocalDemoSiteSchedule(store, 'missing', { enabled: true, intervalMinutes: 15 }), /Ativo n.o encontrado/);
  assert.throws(() => configureLocalDemoSiteSchedule(store, 'site-1', { enabled: true, intervalMinutes: 10 }), /intervalo v.lido/);
});

test('local demo monitor schedule endpoint persists its isolated configuration without external calls', () => {
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const values = new Map([['focusshub.local-demo.v1', JSON.stringify({
    'site-assets': [{ id: 'site-1', name: 'Site Aurora' }],
    monitors: [{ id: 'unlinked', name: 'Outra automação' }],
  })]]);
  globalThis.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  globalThis.window = { location: { origin: 'http://localhost' }, dispatchEvent: () => {} };
  try {
    const result = handleLocalDemoRequest('/api/workspace/site-assets/site-1/monitor', {
      method: 'POST', body: JSON.stringify({ enabled: true, intervalMinutes: 15 }),
    });
    assert.equal(result.data.enabled, true);
    assert.equal(result.data.schedules[0].siteAssetId, 'site-1');
    assert.equal(result.data.schedules[0].demoTag, 'DEMONSTRAÇÃO LOCAL · SEM CONSULTA EXTERNA');
    const persisted = JSON.parse(values.get('focusshub.local-demo.v1'));
    assert.equal(persisted.monitors[0].enabled, true);
    assert.equal(persisted.monitors[1].id, 'unlinked');
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});
