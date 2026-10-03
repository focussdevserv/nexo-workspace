import assert from 'node:assert/strict';
import test from 'node:test';
import { checkLocalDemoSite, getLocalDemoSiteHistory, removeLocalDemoSiteAsset } from './local-demo-monitoring.js';

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
